# Codex Mobile Pairing Incident

## 背景

这是一份公开存档，记录一次 Codex 桌面端与移动端远程连接失败的排查过程。

目标很简单：在手机端连接电脑上的 Codex，继续桌面端正在进行的任务，并允许移动端远程控制这台电脑上的 Codex。

最终结果：连接成功。问题不是扫码姿势、手机端账号，也不是单纯代理故障，而是桌面端没有生成真正的远程配对码。

## 现象

桌面端设置页进入连接/移动端配对流程后，只显示二维码，没有明显的手动配对码。

扫码后，手机端提示配对失败，或提示这不是有效的远程配对代码。

桌面端曾出现类似错误：

```text
Couldn't enable remote control. Try again
```

多次重启、切换代理、重新打开设置页后，二维码看起来会刷新，但手机端仍无法完成配对。

## 关键发现

截图里的二维码被解码后，内容并不是配对链接，而只是一个打开手机端页面的 deep link：

```text
com.openai.chat://codex/open
```

这类二维码只能打开 App，不包含真正的远程配对信息。

真正的配对二维码应该包含短效配对信息，结构类似：

```text
https://chatgpt.com/codex/pair?pairing_code=...
```

或者桌面端应该给出一个短效手动配对码，格式类似：

```text
XXXX-XXXX
```

因此，扫码失败不是因为手机扫错，也不是用户找错入口，而是桌面端当时没有拿到真正的 pairing code。

## 排查过程

### 1. 检查二维码内容

首先对多张桌面端截图中的二维码进行解码。

所有截图都解出同一个静态 deep link：

```text
com.openai.chat://codex/open
```

这说明二维码本身没有携带远程配对码。

### 2. 检查本地状态

随后检查 Codex 本地状态数据库和全局状态文件，发现本地存在远程控制相关记录，但桌面 UI 仍把远程连接流程判断为未完成。

本地状态曾有不一致现象：不同状态库中的远程 enrollment 记录并不完全同步。处理时做了备份，并把本地远程记录同步到一致状态。

这一步修复了本地状态不一致，但没有直接解决二维码问题。

### 3. 检查代理与网络

排查过系统代理和用户环境变量中的代理配置，并确认桌面端可以通过代理连接远程控制 websocket。

日志中能看到 websocket 连接成功，因此最终判断：代理可能影响重连体验，但不是这次配对码缺失的根因。

### 4. 检查服务端状态

通过已登录的 Codex/ChatGPT 会话访问相关服务端接口，返回结果显示远程环境和已配对客户端列表为空。

这说明桌面端处于一种尴尬状态：

- 本地有部分远程控制痕迹
- 服务端没有完整的远程环境/客户端记录
- 桌面 UI 因此没有进入真正的配对码生成状态

### 5. 检查桌面端前端逻辑

解包并阅读 Codex 桌面端前端资源后，确认 UI 逻辑大致如下：

- 如果 `remoteControl/pairing/start` 返回了 `pairingCode`，桌面端会生成真正的配对二维码
- 如果没有拿到 `pairingCode`，桌面端会退回显示静态二维码

静态二维码内容就是：

```text
com.openai.chat://codex/open
```

这解释了为什么桌面上“看起来有二维码”，但手机端始终无法配对。

### 6. 检查 CLI 版本差异

本机存在两个 Codex 版本：

- 桌面 App 内置的 Codex 版本较旧
- 全局安装的 Codex CLI 版本较新

较新的 CLI 中已经有远程配对相关命令：

```text
codex remote-control pair
```

但在 Windows 上直接运行该命令会失败，原因是 CLI 的 app-server daemon 生命周期命令当时只支持 Unix 类平台。

因此不能直接靠普通 CLI 命令生成配对码。

## 解决方法

最终绕过桌面 UI 和 Windows daemon 限制，直接启动本机 Codex app-server 的 stdio 接口，然后调用内部远程控制协议。

核心思路：

1. 启动本机 app-server
2. 发送初始化请求
3. 读取远程控制状态
4. 调用配对码生成接口

关键内部方法是：

```text
remoteControl/pairing/start
```

请求参数里启用手动码：

```json
{
  "manualCode": true
}
```

成功后，app-server 返回：

```json
{
  "pairingCode": "...",
  "manualPairingCode": "XXXX-XXXX",
  "environmentId": "...",
  "expiresAt": 1234567890
}
```

其中 `manualPairingCode` 就是手机端可以输入的短效手动配对码。

输入该手动码后，移动端成功连接桌面端。

## 最终结论

这次问题的根因是：

Codex 桌面 UI 没有成功生成真正的远程配对码，只显示了用于打开 App 的静态二维码。

所以反复扫码失败并不是用户操作问题。真正有效的配对信息必须来自 `remoteControl/pairing/start` 返回的 `pairingCode` 或 `manualPairingCode`。

## 公开存档时已移除的信息

本文档刻意删除或泛化了以下内容：

- 真实账号信息
- 本机用户名
- 电脑名称
- 安装 ID
- 环境 ID
- 访问 token
- 服务端完整返回体
- 真实短效配对码
- 本机代理端口和完整代理配置
- 本地 Codex 数据库绝对路径

## 复盘

这次排查里最容易误判的地方是二维码。

桌面端确实显示了二维码，但二维码不等于配对码。只有解码后看到 `pairing_code` 或拿到 `manualPairingCode`，才说明配对信息真的生成成功。

以后如果再次遇到类似问题，可以优先检查三件事：

1. 二维码解码后是否包含 `pairing_code`
2. 桌面端是否成功调用了 `remoteControl/pairing/start`
3. app-server 返回里是否存在 `manualPairingCode`
