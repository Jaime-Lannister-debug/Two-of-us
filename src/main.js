// 浏览器唯一启动入口，不向 window 暴露状态或业务函数。
import { createApplication } from './app.js';
const app = createApplication();
void app.start();
