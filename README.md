# cf-copilot-service
 
## 使用方法

1. 你需要拥有一个有Github Copilot权限的Github账户
2. 使用[cocopilot](https://cocopilot.org/copilot/token)获取token
3. 创建一个CLoudflare Worker
4. 创建一个KV容器
5. 将KV容器绑定到Worker中（可以在Setting -> Variables下找到）
6. 修改代码第一行的`GITHUB_COPILOT_CHAT`为你绑定KV namespace时使用的变量名称
7. 将[cf_copilot_service.js](./cf_copilot_service.js)中的内容粘贴到Worker编辑器页面中
8. 保存并部署Worker
9. 打开任意支持自定义OpenAI Endpoint的前端应用
10. 设置Endpoint为你的Worker地址，key为第一步中的token
11. 开始使用吧

## 致谢

https://github.com/aaamoon/copilot-gpt4-service