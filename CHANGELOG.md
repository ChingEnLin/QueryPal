## [2.15.2](https://github.com/ChingEnLin/QueryPal/compare/v2.15.1...v2.15.2) (2026-07-12)

### Bug Fixes

* **ci:** remove inline comments from Cloud Run flags/env_vars blocks ([a84f0ce](https://github.com/ChingEnLin/QueryPal/commit/a84f0ce2c7e7b801e729bacb3d86199e88e176db))

## [2.15.1](https://github.com/ChingEnLin/QueryPal/compare/v2.15.0...v2.15.1) (2026-07-12)

### Bug Fixes

* **admin:** stop role & PG cells from wrapping in the users table ([940b277](https://github.com/ChingEnLin/QueryPal/commit/940b2773132cc4631897d27f5fbe6943ee6621db))
* **ci:** backend Cloud Run egress all-traffic so PG exits via static IP ([85394f7](https://github.com/ChingEnLin/QueryPal/commit/85394f703b11e9774ba9978811f1e4f7afd8d32c))
* **ci:** set PG_ADMIN_LOGIN so admin role-management can reach PG ([1fd79ec](https://github.com/ChingEnLin/QueryPal/commit/1fd79ecec09da613811ce9aa36f6aa4395ba1fe8))

## [2.15.0](https://github.com/ChingEnLin/QueryPal/compare/v2.14.1...v2.15.0) (2026-07-12)

### Features

* **admin:** friendly IP-whitelist guidance on PG connection timeout ([a0481dd](https://github.com/ChingEnLin/QueryPal/commit/a0481dd41049fa0edcca78ecc01bb7f66aef03a6))
* **admin:** roles/permissions reference + disable Workspace/Audit nav on /admin ([f2ec3c9](https://github.com/ChingEnLin/QueryPal/commit/f2ec3c9e8a3661056288f74a3c6879867226a3b5))
* **admin:** self-service PostgreSQL write access (opt-in) ([c759478](https://github.com/ChingEnLin/QueryPal/commit/c75947879fde8cadf509f354b00c51067c87bc00))
* **audit:** centered loader during initial audit log load ([07c4e38](https://github.com/ChingEnLin/QueryPal/commit/07c4e385cdb61d55519622188356c61dfd06bd38))
* **audit:** engine-aware Ask tab example question ([209845c](https://github.com/ChingEnLin/QueryPal/commit/209845c42b682fa0b07ea3c27bae5d1f452880c7))
* **audit:** row/table terminology in PG audit view ([942fea3](https://github.com/ChingEnLin/QueryPal/commit/942fea3d9874cc107116394e29add93ffc9afbda))
* **auth:** allow explicit OBO scope for PostgreSQL token exchange ([b5d9593](https://github.com/ChingEnLin/QueryPal/commit/b5d95933915d60ea5844f6133ba83c8df2a9dbd3))
* **explorer:** parse array-column input + type hints in row drawer ([dfc84be](https://github.com/ChingEnLin/QueryPal/commit/dfc84bebf2596f75001fbc4e59560b298973ae8d))
* **nav+audit:** move Admin to profile menu, add Audit to sidebar, enrich PG audit ([f1e8a5a](https://github.com/ChingEnLin/QueryPal/commit/f1e8a5a965c0230dd4b35c2c2b5b06ac432894db))
* **pg:** /postgres routes for discovery, explore, nl2sql, execute ([1db9d96](https://github.com/ChingEnLin/QueryPal/commit/1db9d96a05b4bc706df847f9cee81122a3c34b1b))
* **pg:** admin grant/revoke/list PostgreSQL access endpoints ([58335e7](https://github.com/ChingEnLin/QueryPal/commit/58335e78e510f0c99d5ddf5f4afdfcdbf3803577))
* **pg:** ARM discovery and schema introspection ([a252e7b](https://github.com/ChingEnLin/QueryPal/commit/a252e7bf7ff14e789f778763741044064b5affe7))
* **pg:** enable PostgreSQL in hub catalog + engine filter + coherent cards ([3ca2bb8](https://github.com/ChingEnLin/QueryPal/commit/3ca2bb893fddb5d1c80029a8216ee17eb7de9db7))
* **pg:** Entra OBO psycopg2 connection helper ([fefac87](https://github.com/ChingEnLin/QueryPal/commit/fefac871ff506deaf441c92cb1ffbbe21da96773))
* **pg:** frontend dbService client for /postgres endpoints ([de3af13](https://github.com/ChingEnLin/QueryPal/commit/de3af137085eaed32d5640ec222f4d7139a785ef))
* **pg:** grant/revoke PostgreSQL access from the admin page ([eaafb28](https://github.com/ChingEnLin/QueryPal/commit/eaafb28fb4a84d81326fa2a989f8699e6d5945ca))
* **pg:** multi-table NL2SQL grounding + workspace UX fixes ([931e588](https://github.com/ChingEnLin/QueryPal/commit/931e588ef16cc02b3ddb5b20f83f3c8478d0d915))
* **pg:** NL->SQL ReAct agent with read-only test execution ([0ebe868](https://github.com/ChingEnLin/QueryPal/commit/0ebe8681e3ac6f79173842e15017ceda63df344a))
* **pg:** PostgreSQL explorer page reachable from hub and sidebar ([d66e92f](https://github.com/ChingEnLin/QueryPal/commit/d66e92f5235898d92523f7aab77b3ba34112dfe7))
* **pg:** read-only SQL execution and write/DDL detection ([ea4775c](https://github.com/ChingEnLin/QueryPal/commit/ea4775c78556178fcf41c6d0acc40ceab3b79dc9))
* **pg:** rebuild Query Workspace to match design + sidebar-native nav ([d1d7b72](https://github.com/ChingEnLin/QueryPal/commit/d1d7b7259ccfa0452592d24263791a5f2446c713))
* **pg:** request schemas for /postgres routes ([991a13f](https://github.com/ChingEnLin/QueryPal/commit/991a13f844de9381fba037f54080fe0cf15c7fbf))
* **pg:** saved queries for the PostgreSQL workspace ([efe69df](https://github.com/ChingEnLin/QueryPal/commit/efe69dfce9dea6421251d5bb3d77040e3418f991))
* **postgres:** add row browse + CRUD routes behind Entra-OBO connection ([cd20653](https://github.com/ChingEnLin/QueryPal/commit/cd20653191d6e493b690071b7c4950aaf564ebf7))
* **postgres:** data explorer page with grid, filters, and row CRUD drawer ([e593a7d](https://github.com/ChingEnLin/QueryPal/commit/e593a7dbfa36e7f773f57c2aad01fefa889b73b5))
* **postgres:** dbService client fns for row browse + CRUD ([0d4c464](https://github.com/ChingEnLin/QueryPal/commit/0d4c464ad58b693ebf79f2c460f9f2a7ab4a9bf4))
* **postgres:** loading spinners for db switch + schema load ([df4b6a1](https://github.com/ChingEnLin/QueryPal/commit/df4b6a12d56c0120b95f3852f187ba21bf1a5f5f))
* **postgres:** move Database section to the bottom of the connection chip dropdown ([ee4cf22](https://github.com/ChingEnLin/QueryPal/commit/ee4cf22b4aab901674e5844fd309f31e8c579f24))
* **postgres:** parameterized row CRUD SQL builders ([d3d2a8c](https://github.com/ChingEnLin/QueryPal/commit/d3d2a8c0f897ee5877e1ddf12cc48dfe72d2d247))
* **postgres:** request schemas for row CRUD endpoints ([f71840f](https://github.com/ChingEnLin/QueryPal/commit/f71840f06d4937f8b291fc87b3bbd7965eca8531))
* **postgres:** switch database from the connection chip on the data explorer ([9a1733e](https://github.com/ChingEnLin/QueryPal/commit/9a1733eb5f68b92af7bd52a8ee41e60599394467))
* **query:** always produce three actionable analyze follow-ups ([3b105bb](https://github.com/ChingEnLin/QueryPal/commit/3b105bb2295be00888ed7bd537852177530cf4f7))
* **query:** analyze returns suggested follow-up questions ([4b31ef4](https://github.com/ChingEnLin/QueryPal/commit/4b31ef4677360909c8bb8d6323f4b85f701d49bc))
* **query:** clickable analyze follow-up prompts ([6adffe9](https://github.com/ChingEnLin/QueryPal/commit/6adffe95265380ad37151c152b596a4ee241ba9c))
* **query:** Explain button with plain-English explanation card ([2272349](https://github.com/ChingEnLin/QueryPal/commit/22723498bdcbf3f4d072ead0355339b619472624))
* **query:** plain-English explain endpoint for Mongo queries ([e692131](https://github.com/ChingEnLin/QueryPal/commit/e6921315d84700e553bb0fc6a8e3dee9f07bef89))
* **query:** Query collection template button ([0c49d06](https://github.com/ChingEnLin/QueryPal/commit/0c49d06a4278ca739e76a55f35b8cffde4f8e25e))
* **query:** surface ReAct agent verdict in both workspaces ([d4295e6](https://github.com/ChingEnLin/QueryPal/commit/d4295e63d84ab3db11a035ed505ab3c317768fc2))

### Bug Fixes

* **audit:** allow null document_id in /recent response ([d2ae15a](https://github.com/ChingEnLin/QueryPal/commit/d2ae15a6185f819f4cf530f8158ac014189a051f))
* **audit:** don't crash on non-CRUD ops in PG audit log ([32349d1](https://github.com/ChingEnLin/QueryPal/commit/32349d14f3d92875cdee9250e7832cbe9e3297a9))
* **audit:** keep PG connection context on the audit page ([c5d8823](https://github.com/ChingEnLin/QueryPal/commit/c5d8823bb16214a4baa85637328f7e4a8f50a1bf))
* **audit:** make PG->Cosmos account switch immediate + reliable ([5a4fdd8](https://github.com/ChingEnLin/QueryPal/commit/5a4fdd82cc60631065453a20218222ed28d6b65c))
* **audit:** record real before/after diff for PG row updates ([dedd54d](https://github.com/ChingEnLin/QueryPal/commit/dedd54dce622e84eea3941d955fb86b06ba2ae24))
* **audit:** switching PG audit -> Cosmos account stays on the audit page ([8d2868e](https://github.com/ChingEnLin/QueryPal/commit/8d2868e39b6fc12fc095d74ef368faa9a0525e2c))
* **cors:** allow PATCH so row updates aren't blocked ([c3bc77e](https://github.com/ChingEnLin/QueryPal/commit/c3bc77ee96add0f750bc2f2a6e979ade63e8bb65))
* **explorer:** let users enter primary key on insert (natural keys) ([bc60a60](https://github.com/ChingEnLin/QueryPal/commit/bc60a6044a71f5fd16c749a18d6914ce08f0d95d))
* **explorer:** surface row-write errors + omit blank fields on insert ([54730a3](https://github.com/ChingEnLin/QueryPal/commit/54730a33b81936f2e83f01db84a0e062da325dd8))
* **hub:** consistent Workspace naming + Explorer button on PG card ([7d852c2](https://github.com/ChingEnLin/QueryPal/commit/7d852c2bc86962140fe2f548e279ae24e0c06ed1))
* **pg:** accurate access status + graceful table sample on no read grant ([2045841](https://github.com/ChingEnLin/QueryPal/commit/2045841473676af688c5af6d676363be927d12aa))
* **pg:** fail fast on unreachable server with connect_timeout ([19db881](https://github.com/ChingEnLin/QueryPal/commit/19db881e72a7fe2a40dcc58d048dd4d729d3ebf1))
* **pg:** show unknown row estimate as em dash, not -1 ([a80b82a](https://github.com/ChingEnLin/QueryPal/commit/a80b82a9ca59dd644f5ea7732024b38a0a601e2e))
* **pg:** stabilize admin page PostgreSQL column UX ([6a38bf8](https://github.com/ChingEnLin/QueryPal/commit/6a38bf8849ed41686ec14344cd285d679296e2f0))
* **postgres:** parse JSON column values in row drawer on save ([8dddb06](https://github.com/ChingEnLin/QueryPal/commit/8dddb06bf0001d6a2d61c7445c88b91c0135e993))
* **postgres:** surface DB constraint errors as HTTP 400 in row CRUD ([af76b9d](https://github.com/ChingEnLin/QueryPal/commit/af76b9d2e040f473a81c2f3c9ae18134f1927e2d))
* **query:** attach auth token to analyze + debug requests ([593f0da](https://github.com/ChingEnLin/QueryPal/commit/593f0da82b223cd620b2233a6c288118e10a7d94))
* **sidebar:** keep PG Explorer nav enabled without a database ([7cc2a0f](https://github.com/ChingEnLin/QueryPal/commit/7cc2a0f65d92511e2037412af84b1d41344989b3))

### Maintenance

* **admin:** surface + log PostgreSQL access-connection errors ([30946ba](https://github.com/ChingEnLin/QueryPal/commit/30946ba72a9b310b48967cb04cb1a8eafb140a08))

### Documentation

* **postgres:** document _qt caller-validation contract ([dcdf289](https://github.com/ChingEnLin/QueryPal/commit/dcdf2892fdcdab5e6409cf482ba2763a9f33d314))
* **postgres:** spec PG data explorer + rename workspace page ([2215a34](https://github.com/ChingEnLin/QueryPal/commit/2215a3401b252586c03457693881355cd611a608))

### Styling

* **backend:** apply black formatting (CI check) ([74bfcbd](https://github.com/ChingEnLin/QueryPal/commit/74bfcbd9ef00a57493cdd70b2b959203a02d7db5))

### Refactoring

* **query:** align Cosmos Insights rail with PostgreSQL ([e3c9b4b](https://github.com/ChingEnLin/QueryPal/commit/e3c9b4be28f46f89e6230687407491681d8f4bfe))
* **query:** move analysis insight + follow-ups to the Insights rail ([9ef862a](https://github.com/ChingEnLin/QueryPal/commit/9ef862a60c96972ff2c95bff356cb64304cee9b9))
* **query:** move Analyze trigger to the Insights rail (PG parity) ([cf9a2ef](https://github.com/ChingEnLin/QueryPal/commit/cf9a2ef6e2fef6188c82f185e60abbe695c2b28c))

## [2.14.1](https://github.com/ChingEnLin/QueryPal/compare/v2.14.0...v2.14.1) (2026-06-22)

### Bug Fixes

* **query-gen:** make datetime queries work in the eval sandbox ([#45](https://github.com/ChingEnLin/QueryPal/issues/45)) ([520da1f](https://github.com/ChingEnLin/QueryPal/commit/520da1f176d657f22e88a50f4bcb737bd92e7669))

## [2.14.0](https://github.com/ChingEnLin/QueryPal/compare/v2.13.0...v2.14.0) (2026-06-06)

### Features

* **rbac:** JWT verification, role-based access control, and admin role management UI ([#41](https://github.com/ChingEnLin/QueryPal/issues/41)) ([adb1667](https://github.com/ChingEnLin/QueryPal/commit/adb16672f5c065a60df8766fadc05971a0c20d88))
* **ux:** hub recents, ⌘K palette, saved-query search, write-op guards ([#43](https://github.com/ChingEnLin/QueryPal/issues/43)) ([81ea908](https://github.com/ChingEnLin/QueryPal/commit/81ea908ed2f855b9e1f401cda4baac0c0d465ea6))

### Maintenance

* resolve merge conflicts for dev → production ([21fbfc4](https://github.com/ChingEnLin/QueryPal/commit/21fbfc4d4ecab67b3da29c5e95d9ab320712af52))

### Documentation

* update README, architecture, and development docs with recent features ([8ef232d](https://github.com/ChingEnLin/QueryPal/commit/8ef232d39269304d8afbfb078ef0a4c2e6f0f1e4))

## [2.13.0](https://github.com/ChingEnLin/QueryPal/compare/v2.12.0...v2.13.0) (2026-06-06)

### Features

* **rbac:** JWT verification, role-based access control, and admin role management UI ([#41](https://github.com/ChingEnLin/QueryPal/issues/41)) ([#42](https://github.com/ChingEnLin/QueryPal/issues/42)) ([8c010c4](https://github.com/ChingEnLin/QueryPal/commit/8c010c4b29b31a3de23cea925cdcca2834d758be))

## [2.12.0](https://github.com/ChingEnLin/QueryPal/compare/v2.11.0...v2.12.0) (2026-05-28)

### Features

* **argus:** structured observers + live progress polling ([#39](https://github.com/ChingEnLin/QueryPal/issues/39)) ([d0e02d7](https://github.com/ChingEnLin/QueryPal/commit/d0e02d7f2d66107c1e239b471b8987bfeef9b2af)), closes [#2](https://github.com/ChingEnLin/QueryPal/issues/2)

## [2.11.0](https://github.com/ChingEnLin/QueryPal/compare/v2.10.1...v2.11.0) (2026-05-25)

### Features

* add .venv to .gitignore for virtual environment exclusion ([7453fe8](https://github.com/ChingEnLin/QueryPal/commit/7453fe8e75b0d42e272f64287abe7d626710108b))
* add dynamic model selection for LLM queries ([32147f9](https://github.com/ChingEnLin/QueryPal/commit/32147f9dc50412512d6325aedf38ff44ddadf1e5))
* add QueryArgus data-quality UI on Analytics page ([0ed0ce0](https://github.com/ChingEnLin/QueryPal/commit/0ed0ce0a17d0b3d95f3289fd0e8c7dbe0f25e28d))
* **analytics:** model selection for QueryArgus runs ([87572a5](https://github.com/ChingEnLin/QueryPal/commit/87572a513949f14969b2800a9ca4c679def7dcc7))
* **analytics:** model selection, gemini-only judge, and improvement hints ([00b9342](https://github.com/ChingEnLin/QueryPal/commit/00b934257cf7467d9887c55e2c26667544e19b28))
* **analytics:** notifications system for async Argus runs ([e2575c9](https://github.com/ChingEnLin/QueryPal/commit/e2575c9ff515764ce863d1d135fcf0c73dac09f2))
* **analytics:** sidebar audit cues, finding filters, and notification deep-link ([621aa0e](https://github.com/ChingEnLin/QueryPal/commit/621aa0edb14685aafec50775059f78185dd90e8c))
* **argus:** persist reports, add history tab, async run, tooltips ([f56a4ec](https://github.com/ChingEnLin/QueryPal/commit/f56a4ecbf5dbb7523fb297da8bd9a22ab92d0b6b))
* **argus:** post-hoc finding rating endpoint + UI (Arm A) ([0cc40f1](https://github.com/ChingEnLin/QueryPal/commit/0cc40f1f3294ecc9f32917705419399a8289761f))
* **argus:** tiered run configuration with saved custom profiles ([2030d8f](https://github.com/ChingEnLin/QueryPal/commit/2030d8f3d9c4918a95bec5754d69f3fc7da491e1))
* **argus:** trends tab with quality, severity, and token charts ([3f8e772](https://github.com/ChingEnLin/QueryPal/commit/3f8e7723f3959a46c1c92dfde50bc517e82f9c9a))
* enhance collection selection and loading states across components ([6c7356a](https://github.com/ChingEnLin/QueryPal/commit/6c7356ad6d73226b07bd18c61924b24841807738))
* harden Cloud Run security with Secret Manager, VPC connector, and private backend ([27bb9b5](https://github.com/ChingEnLin/QueryPal/commit/27bb9b55cf7a69009338c0613ab71f50e0ed5c64))
* integrate QueryArgus as data-quality audit endpoint ([bd42169](https://github.com/ChingEnLin/QueryPal/commit/bd421693f0da4004df3879bed194f19e0bc0a319))
* **query:** inject inferred relationships and $lookup guidance for multi-collection prompts ([6e5fc22](https://github.com/ChingEnLin/QueryPal/commit/6e5fc2246224f98e579b2a832ad200f2be5c39a3))

### Bug Fixes

* address claudebot review issues on model selection PR ([f83e159](https://github.com/ChingEnLin/QueryPal/commit/f83e159b5a0205e525a21847b460588a1ecf5891))
* align Terraform DB config and reorganize docs ([#33](https://github.com/ChingEnLin/QueryPal/issues/33)) ([8cc3d18](https://github.com/ChingEnLin/QueryPal/commit/8cc3d18fed60ce62c15f84a62bf0c831743fa45e))
* **argus:** address claudebot review — auth, eviction, formatting ([d4ca8ab](https://github.com/ChingEnLin/QueryPal/commit/d4ca8abad736783309a6b580666b1beeff5c864a))
* construct Cloud Run SA email inline to use PROJECT_ID, clarify VITE_API_BASE_URL ([cdb3ddb](https://github.com/ChingEnLin/QueryPal/commit/cdb3ddb982ce09746ad1bd302f23f142b624778e))
* **query:** Cosmos-safe $lookup guidance, retry-prompt, nested ObjectId serialization ([ed276a1](https://github.com/ChingEnLin/QueryPal/commit/ed276a1c11224c4d3531b9019a1360ba906a9298))
* **query:** resolve contradictory retry instruction and review feedback ([9b5c976](https://github.com/ChingEnLin/QueryPal/commit/9b5c976d414207301dab25e1cfbd841c24a94ff3)), closes [#0](https://github.com/ChingEnLin/QueryPal/issues/0)
* show per-card loader on Hub when opening Explorer or account ([d069d8f](https://github.com/ChingEnLin/QueryPal/commit/d069d8fa52d788dd231914cd7ef96b925a939fa3))

### Maintenance

* gitignore HITL experiment artifacts ([205df64](https://github.com/ChingEnLin/QueryPal/commit/205df641b133df42be4c5a6efd5c644a9fdcb9ff))
* resolve INFRASTRUCTURE.md conflict for dev → production merge ([dca0412](https://github.com/ChingEnLin/QueryPal/commit/dca04129ab47d38cca5db09d9f3eed99785552b7))
* **submodule:** bump queryargus to harden Arm A FP-skip prompt ([71e25f2](https://github.com/ChingEnLin/QueryPal/commit/71e25f2cd9410cfd281c4e1b7d5a7c5f0179677c))
* wire QueryArgus submodule into Docker, CI, and tooling ([ff3bd38](https://github.com/ChingEnLin/QueryPal/commit/ff3bd38801a7e572655fce3decd9291c5028ca8c))

### Documentation

* add infrastructure documentation with architecture diagrams to README ([2ca3e11](https://github.com/ChingEnLin/QueryPal/commit/2ca3e1101e7eb2b2ed4760ca1ae9df2e4c98a9a4))

### CI/CD

* **backend:** ignore queryargus submodule tests during pytest collection ([616d538](https://github.com/ChingEnLin/QueryPal/commit/616d5387fa4ebf4b317a00e11b7cafd20229d3d2))
* **backend:** pass --ignore=queryargus to pytest directly ([f382402](https://github.com/ChingEnLin/QueryPal/commit/f38240257b12d65fbb185af8548e2c3c99878860))

## [2.10.1](https://github.com/ChingEnLin/QueryPal/compare/v2.10.0...v2.10.1) (2026-05-17)

### Maintenance

* merge dev into production ([#34](https://github.com/ChingEnLin/QueryPal/issues/34)) ([b363f16](https://github.com/ChingEnLin/QueryPal/commit/b363f16670ccaede184558225b0a654143199f92)), closes [#33](https://github.com/ChingEnLin/QueryPal/issues/33)

## [2.10.0](https://github.com/ChingEnLin/QueryPal/compare/v2.9.0...v2.10.0) (2026-05-14)

### Features

* add DESIGN_HANDBOOK.md to .gitignore ([e72e0eb](https://github.com/ChingEnLin/QueryPal/commit/e72e0eb5d57bc92c08891467315774cec9c6dec0))
* add HubPage and refactor navigation structure ([169074a](https://github.com/ChingEnLin/QueryPal/commit/169074a19d94474d7dd100d479f6e0531e8c5165))
* add support for preselected account navigation in QueryGeneratorPageWrapper ([8bc2338](https://github.com/ChingEnLin/QueryPal/commit/8bc2338989b7cbc94857a28a037c5ef99da675f7))
* enhance Data Explorer and Query Generator with session management and improved navigation ([4aeed9e](https://github.com/ChingEnLin/QueryPal/commit/4aeed9e9cfca146498270c970bcbfea651886966))
* enhance QueryDisplay and DataExplorer components with filter state and handover functionality ([fc3d144](https://github.com/ChingEnLin/QueryPal/commit/fc3d144162f59fba48131a1b78913643d7965fd5))
* enhance ShareQueryDialog and ShortcutCheatsheet components with improved styling and functionality ([bccd212](https://github.com/ChingEnLin/QueryPal/commit/bccd2129f85d8bf619aae8b2741e8c5c72fc5400))
* enhance UI components and add command palette functionality ([53795d4](https://github.com/ChingEnLin/QueryPal/commit/53795d4002eac1a04bc285aca4ae6e2f2fc57736))
* implement AnalyticsPageWrapper for session management and routing ([fb15a31](https://github.com/ChingEnLin/QueryPal/commit/fb15a31d735fd9a343bbf8c13c40f0ce92694070))
* pass initialCollection state when navigating from CommandPalette ([0510ba8](https://github.com/ChingEnLin/QueryPal/commit/0510ba88cbba56c14dd6967fef0e59af0b10b5a6))
* refactor AppSidebar and DataExplorerPageWrapper for improved state management and UI consistency ([092b491](https://github.com/ChingEnLin/QueryPal/commit/092b4913e1d84aebcbbc3bf8285a20ce8d41397d))
* refactor query execution logic and enhance saved query handling ([6a7d31f](https://github.com/ChingEnLin/QueryPal/commit/6a7d31fa320772bd848baa4fda74a52a97c4b4ce))
* remove 'Audit Log' from AppSidebar and HubPage navigation ([0ccefaa](https://github.com/ChingEnLin/QueryPal/commit/0ccefaa376c1f7a2a9d2f759affc4c0dba9e15f0))
* rework LoginPage UI with enhanced design and functionality ([7684762](https://github.com/ChingEnLin/QueryPal/commit/7684762f6a1501bbd0cfbed7fdd53bcd2ff636ac))
* update database engine badges to reflect availability status ([706bb77](https://github.com/ChingEnLin/QueryPal/commit/706bb771a059699d30fcb4f86cb30df364f8db65))

### Bug Fixes

* apply black formatting to react_agent_service.py ([8305dfb](https://github.com/ChingEnLin/QueryPal/commit/8305dfb09013f3b18f6020cba92a7dcb0c8b5f79))

### Refactoring

* update Claude Code Review workflow to trigger on issue comments and pull request review comments ([b945405](https://github.com/ChingEnLin/QueryPal/commit/b945405c6853039be161293f98bfe14b9bb683ad))

## [2.9.0](https://github.com/ChingEnLin/QueryPal/compare/v2.8.0...v2.9.0) (2026-05-10)

### Features

* Add filter type to support date filtering in the data explorer. ([2c00ecb](https://github.com/ChingEnLin/QueryPal/commit/2c00ecbf396c6768d088a6f0cb2c61a0084cc41d))
* add functionality to export Data Explorer filters as PyMongo query string ([c21717c](https://github.com/ChingEnLin/QueryPal/commit/c21717c9a374269248afc6ff8c7debbd2990ad82))
* configurable agent iterations with UI slider and aggregation support ([1e61b7f](https://github.com/ChingEnLin/QueryPal/commit/1e61b7f5889b2c3c544779b515680e3030e1e363))
* generalize image preview component to support both base64 and URL images. ([2ef9493](https://github.com/ChingEnLin/QueryPal/commit/2ef949379fdbfb7c634d3e96214bf5984346df43))
* implement AI-driven ReAct agent for query generation ([2c581f2](https://github.com/ChingEnLin/QueryPal/commit/2c581f293a9dd89c0a607cca15207ad04bf46041))
* implement automated logging for database write operations in query execution routes ([fcc04b1](https://github.com/ChingEnLin/QueryPal/commit/fcc04b13ed8448b7c5cbe6e963afcdbf949666bb))
* Implement multiple resizable document panels, "open to side" functionality, and document persistence in the Data Explorer. ([fc84a35](https://github.com/ChingEnLin/QueryPal/commit/fc84a355b015b741d31ab668875bfb18ec205cf0))
* Implement save conflict detection and resolution with a diff viewer for document edits. ([cc164e6](https://github.com/ChingEnLin/QueryPal/commit/cc164e6f408ca7c3925a37aad93c059caf2fb62e))

### Bug Fixes

* security and reliability hardening ([4660c09](https://github.com/ChingEnLin/QueryPal/commit/4660c09b7d13d065171dcd93ef000f47726145f6))

### Maintenance

* mock GEMINI_API_KEY for CI tests ([b0dd3dc](https://github.com/ChingEnLin/QueryPal/commit/b0dd3dcef25d5c7b0677a2894cbc111a63785767))

### Documentation

* add ReAct agent documentation and architecture diagram to README ([bc75e8e](https://github.com/ChingEnLin/QueryPal/commit/bc75e8e565290640922110f9c7e64ca396da6897))

## [2.8.0](https://github.com/ChingEnLin/QueryPal/compare/v2.7.0...v2.8.0) (2026-03-12)

### Features

* Add loading indicators and state management for database connection and quick exploration actions. ([f6de6aa](https://github.com/ChingEnLin/QueryPal/commit/f6de6aa6a5620476ff4fce5919cd0f19fac5d5a0))
* add resizable panels to the Data Explorer layout. ([1c83eca](https://github.com/ChingEnLin/QueryPal/commit/1c83ecabbcdd248a6172f771ceb41ba5f1c9faba))
* Filter out datetime fields from document history diffs and add react-resizable-panels dependency. ([8acb561](https://github.com/ChingEnLin/QueryPal/commit/8acb561b39c637f665b7ca5f938794bebbd23d7a))
* Implement multiple document filtering with various operators in the Data Explorer. ([a7dd5dd](https://github.com/ChingEnLin/QueryPal/commit/a7dd5dd4217db722fc773ec1f82f38a4ebeea984))
* Implement robust MSAL token acquisition with silent/popup fallback and expand authentication error handling. ([2bbbfa9](https://github.com/ChingEnLin/QueryPal/commit/2bbbfa98553b1aff9fafc0440d862df3d8db74d3))
* Introduce a diff-based overwrite dialog to prevent loss of unsaved document edits when refreshing. ([63127e1](https://github.com/ChingEnLin/QueryPal/commit/63127e19d2d863e191f499e2e0a8c60a7064c7aa))

### Styling

* Apply consistent formatting to DataExplorerPage.tsx. ([0e03ad9](https://github.com/ChingEnLin/QueryPal/commit/0e03ad9523a3e01801a0fd678312f0d16a4b9560))

## [2.7.0](https://github.com/ChingEnLin/QueryPal/compare/v2.6.0...v2.7.0) (2026-02-07)

### Features

* Add an interactive SVG schema relationship graph component to visualize collection relationships on the query generator page. ([605119d](https://github.com/ChingEnLin/QueryPal/commit/605119d366e63d10911c86f6ec49ef722f52b4e7))
* Enable multi-collection query generation by updating context handling to pass a list of selected collections to the backend. ([943cf44](https://github.com/ChingEnLin/QueryPal/commit/943cf44bb9872ad1961a579cc9c588ecc9696f20))
* Implement schema relationship inference and enhance NL2Query with cross-collection schema context. ([c6ef8db](https://github.com/ChingEnLin/QueryPal/commit/c6ef8dbf67dd1f7aacf1f45c917507c5773ac4ea))
* Replace global Data Explorer button with context-specific explorer buttons and add quick explore options for accounts. ([a268708](https://github.com/ChingEnLin/QueryPal/commit/a268708f42c8abbf395576d88620ee4a4cca9a9c))
* update usability ([a7fea1b](https://github.com/ChingEnLin/QueryPal/commit/a7fea1b1886a6f11ffe4eb3b64bae4eacf3dcf24))

### Bug Fixes

* black format ([53014ed](https://github.com/ChingEnLin/QueryPal/commit/53014ed30da1551598ea30f279365e86441e0c09))
* update test ([a154d65](https://github.com/ChingEnLin/QueryPal/commit/a154d65821928f68346ad0734b1c30d7d7c10703))

## [2.6.0](https://github.com/ChingEnLin/QueryPal/compare/v2.5.0...v2.6.0) (2026-02-02)

### Features

* Add search option icons and enhance JSON display highlighting with regex support. ([66e774c](https://github.com/ChingEnLin/QueryPal/commit/66e774c6834610c16646bf0251352824752514fd))
* Implement base64 image preview with hover tooltip and expand functionality in JsonDisplay. ([438e46a](https://github.com/ChingEnLin/QueryPal/commit/438e46af7da238fe2121efea7166a1820782b782))

## [2.5.0](https://github.com/ChingEnLin/QueryPal/compare/v2.4.0...v2.5.0) (2026-01-12)

### Features

* add AuditPage for analyzing audit logs with visualization and markdown support ([a8f13ea](https://github.com/ChingEnLin/QueryPal/commit/a8f13ea390d8f7aa450118970ad5ea8225037849))

### Bug Fixes

* mock return of test ([495a85f](https://github.com/ChingEnLin/QueryPal/commit/495a85f68d4e1a61bbd1714128bafd4dcd699fe8))
* static code analysis ([d57c968](https://github.com/ChingEnLin/QueryPal/commit/d57c968e01a05337d40d219817d6945d9a9940d2))

## [2.4.0](https://github.com/ChingEnLin/QueryPal/compare/v2.3.0...v2.4.0) (2025-10-28)

### Features

* Enhance CORS configuration for production and development environments ([08afe20](https://github.com/ChingEnLin/QueryPal/commit/08afe20909a8239c41e93df5c26791961c3a8854))

### Bug Fixes

* Update allowed origins for development environment in CORS configuration ([0ba7b95](https://github.com/ChingEnLin/QueryPal/commit/0ba7b95f3ce9781d80299962f6ca30843bc7081b))

### Styling

* Refactor CORS configuration logic and improve formatting in main.py ([a5a335f](https://github.com/ChingEnLin/QueryPal/commit/a5a335f3f1411e36f6fc5d95d67ef196b3638c2f))

## [2.3.0](https://github.com/ChingEnLin/QueryPal/compare/v2.2.0...v2.3.0) (2025-10-01)

### Features

* Implement token renewal service and integrate with authentication flow ([a0da761](https://github.com/ChingEnLin/QueryPal/commit/a0da7611858e180686f371e52bdca6ef6f5ac5c6))

## [2.2.0](https://github.com/ChingEnLin/QueryPal/compare/v2.1.0...v2.2.0) (2025-09-02)

### Features

* Implement authentication error handling utilities and integrate into services ([fbe4540](https://github.com/ChingEnLin/QueryPal/commit/fbe4540fd1f52af9586d5eeb3c445e3d1e93317c))

## [2.1.0](https://github.com/ChingEnLin/QueryPal/compare/v2.0.0...v2.1.0) (2025-09-01)

### Features

* Add semantic versioning workflow with conventional commits ([13dbed7](https://github.com/ChingEnLin/QueryPal/commit/13dbed7616a078b2cd2c27e16f8eef330ad6b264))

### Bug Fixes

* Preserve complete release history in wiki page updates ([85c8e31](https://github.com/ChingEnLin/QueryPal/commit/85c8e31d46b78d26915f91bdbcdbc9e366849669))
* Remove contributing section and update links in README ([9c17f5a](https://github.com/ChingEnLin/QueryPal/commit/9c17f5aedfde60e44517603d9e80b42f7c920595))
* Remove important notice from README and clean up formatting ([9eb1fd1](https://github.com/ChingEnLin/QueryPal/commit/9eb1fd180c585c1647af14c1dd951b13fa832183))
* Update update_document to preserve datetime fields and ensure proper document replacement ([8e9f57e](https://github.com/ChingEnLin/QueryPal/commit/8e9f57e1e3d75f165d3e901daac31dc9cea1e629))
* Use replace_one in update_document to ensure deleted fields are removed ([f7ea61f](https://github.com/ChingEnLin/QueryPal/commit/f7ea61f0b8b7749b280e75666cb2b11ea1cc5365))

### Documentation

* Add semantic versioning documentation and README updates ([a843509](https://github.com/ChingEnLin/QueryPal/commit/a843509674b7d25c1bf9bbbf417d90bf0ef3c54d))

# Changelog

All notable changes to QueryPal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2024-08-29

### Fixed
- Update Docker entrypoint script to set default PORT and modify nginx configuration
