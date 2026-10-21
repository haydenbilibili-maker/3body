# LIFEOS-006 · 三体 IP 合并方案（3body ← 第647号宇宙）

> Jobs(模块整合) + Linus(技术迁移) 联合交付 ｜ 2026-06-16 ｜ 对应任务卡 LIFEOS-006
> Hayden 裁决：3body 为主库，吸收第647号宇宙的特色模块；合并完成后第647归档。

---

## 一、实地勘查结论

| | 3body（主库） | 第647号宇宙（被并入） |
|---|---|---|
| 定位 | 《三体》沉浸式体验沙盒（多模块） | 三体 AI 社区 · 水平编年史时间轴 MVP |
| 前端 | **Vue3 + Vite** + Tailwind（views/router/stores/sim/commercial…） | **Vue3 + Vite** + Tailwind（ChronicleTimeline/StoryDrawer） |
| 后端 | **Python FastAPI** + rag/ + routers/ + services/ + **ChromaDB** + SQLite | **Python**（rag_engine/ingest_rag/sophon_judge）+ **ChromaDB** + Streamlit pages |
| 文档 | 11 份模块 PRD（红岸/人物志/黑暗森林/编年史/思想钢印/智子终端…）+ 商业化 PRD | README（MVP：正史事件 + 同人支线时间轴） |

**核心利好**：两者**技术栈高度同源** —— 都是 Vue3+Vite 前端 + Python 后端 + **ChromaDB**。前端组件 Vue→Vue 直接移植，后端 Python→Python 直接移植，向量库 ChromaDB→ChromaDB 自然合并。比 China/Iran 合并(React vs Vue)友好得多，几乎无框架摩擦。

## 二、关键发现：是"重叠取优"，不是"新增模块"

⚠ **3body 已自带与第647重叠的能力**：
- 3body 已有 **编年史模块**（`backend/models/chronicle.py` + `chronicle_extra.py`，PRD「1.6 编年史重构」）。
- 3body 已有 **黑暗森林广场**（PRD 1.5，社区/广场性质，对应第647的"AI 社区"）。
- 3body 已有 **智子引擎**（`backend/sophon_engine.py`，对应第647的 `sophon_judge.py`）。

➡ 因此合并**不能**简单把第647整体塞进来再造一套编年史/社区——那会重复。正确做法是 **逐能力对比、取优整合**：以 3body 现有模块为基底，吸收第647真正独特、更好的部分，去重。

## 三、第647 的独特资产清单（值得吸收的）

| 资产 | 价值 | 整合去向 |
|------|------|----------|
| `ChronicleTimeline.vue` | **水平编年史时间轴**的具体 UI 实现（3body 编年史可能缺这种横向呈现） | 作为 3body 编年史模块的一种"横向时间轴视图" |
| canon / fan-fiction **分支数据模型** + `timelineData.js` | 正史事件 + 同人支线的结构化建模 | 并入 3body 编年史的数据模型（正史/支线分层） |
| `universe_rules.json` + `sophon_judge.py` | **规则化的"正史校验"**（判断同人内容是否符合宇宙设定） | 增强 3body 智子引擎的"因果律/设定校验"能力 |
| `StoryDrawer.vue` | 支线故事抽屉式阅读交互 | 并入编年史/广场的内容阅读 |
| `pages/*.py`（ETO通讯终端 / 三体AI社区，Streamlit 原型） | 概念原型（创意参考） | 概念折叠进 3body 黑暗森林广场；Streamlit 原型本身退役 |
| `ingest_rag.py` / `rag_engine.py` + ChromaDB 数据 | RAG 语料与检索 | 并入 3body 的 `backend/rag/` + ChromaDB collection |

## 四、整合策略

1. **编年史**：以 3body 编年史模块为主，吸收第647的**横向时间轴视图**与**正史/同人支线分支模型**——给 3body 编年史增加"横向时间轴 + 支线分支"能力，而非新建第二套。
2. **AI 社区**：折叠进 3body 的**黑暗森林广场**，第647的 Streamlit「三体AI社区」作概念参考后退役。
3. **智子/正史校验**：把第647的 `universe_rules.json + sophon_judge` 规则校验能力并入 3body `sophon_engine`，增强"因果律/设定一致性"判定（呼应 3body PRD 3.0 智子终端）。
4. **RAG/向量库**：第647的 RAG 语料导入 3body 的 ChromaDB（独立 collection 或合并），统一检索入口。
5. **去重**：不保留两套编年史/社区/智子；第647重复实现退役。

## 五、迁移分类（决定工作量）

| 类别 | 第647资产 | 处理 | 成本 |
|------|-----------|------|------|
| 直接移植（同栈 Vue） | ChronicleTimeline.vue / StoryDrawer.vue / timelineData.js | 移入 3body frontend，适配其 store/router/设计令牌 | 低 |
| 直接移植（同栈 Python） | rag_engine / ingest_rag / sophon_judge / universe_rules.json | 移入 3body backend rag/services，对接现有接口 | 低-中 |
| **整合去重**（主要工作） | 编年史/社区/智子的重叠能力 | 对比取优、合并数据模型、统一接口，删冗余 | 中（核心） |
| 数据合并 | 第647 ChromaDB + data/ | 导入 3body ChromaDB；⚠ `data_副本` 是冗余，勿导入 | 低 |

➡ **核心判断**：因同栈，移植成本低；真正的工作量在**编年史/社区/智子三处重叠能力的取优整合与去重**，而非重写。

## 六、分阶段实施

1. **阶段1 · 资产盘点对比**：逐项对比 3body 与第647 的编年史/社区/智子实现，确定每处"留谁、并什么"。
2. **阶段2 · 前端吸收**：横向时间轴视图 + 支线抽屉移入 3body 编年史；统一设计令牌。
3. **阶段3 · 后端吸收**：RAG 语料入 3body ChromaDB；规则校验并入 sophon_engine；编年史数据模型加"正史/支线分支"。
4. **阶段4 · 去重收尾**：删除重复实现；Turing 异源验证（编年史/社区/智子核心交互无回归 + 数据迁移完整）；第647原库归档。

## 七、各角色任务（Elon 派单）

- **Jobs**：对齐两者世界观与模块边界，产出"合并后模块地图"——明确编年史/社区/智子各自留谁、并什么、去重清单。
- **Linus**：阶段2-3移植与整合；ChromaDB 数据迁移（排除 data_副本）；附验证包。
- **Turing**：异源验证——合并后编年史(横向时间轴/支线)、广场、智子校验核心交互无回归；RAG 检索与数据迁移完整性。
- **Bezos**：依 3body 的 COMMERCIAL-PRD 评估三体粉丝社区的反馈与商业化诉求。

## 八、风险与边界

- **主风险=重叠整合的判断**：编年史/社区/智子三处需逐一取优，避免合并出"两套并存"的四不像。建议 Jobs 先出模块地图再动手。
- `data_副本` 为冗余副本，迁移时排除，勿污染主库。
- 第647 的 Streamlit pages 是原型，概念吸收后退役，不并入生产前端。
- 合并后以 3body 的 Vue3+Vite+FastAPI+ChromaDB 为唯一技术栈。

## 九、交付清单
- [x] 实地勘查（同栈；3body 已含编年史/社区/智子）
- [x] 关键发现（重叠取优，非新增）
- [x] 第647独特资产清单 + 整合策略 + 迁移分类
- [x] 四阶段 + 角色派单 + 风险
- [ ] Jobs 出"合并后模块地图"（留谁/并什么/去重）
- [ ] Linus 移植与整合（Claude Code）
- [ ] Turing 异源验证
- [ ] 第647原库归档

> 下一步：Jobs 先出模块地图(编年史/社区/智子各取优) → Linus 按阶段2-3吸收第647横向时间轴+RAG+规则校验。合并后 3body 成为唯一三体 IP 主库，第647归档。
