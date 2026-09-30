# Movento BYD · 华人市场 90 天试点

内部提案页面（中文 / Español）。打开 `index.html` 即可，单文件、可离线。

## 修改与重新生成

页面由 `_build/` 里的源文件拼成：

- `template.html`：页面结构与样式
- `app.js`：交互、地图、详情内容、预算计算器
- `mapdata.js`：地图点位数据（由 `build_map.py` 生成）

改完后运行：

```bash
./_build/build.sh
```

## 数据来源

Idescat 2025（人口、按普查区的中国籍人口、收入、汽车保有量）、INE 2025 普查分区、OpenStreetMap（© OpenStreetMap contributors, ODbL）、BYD España、Ajuntament de Badalona。详见页面底部“数据来源”。
