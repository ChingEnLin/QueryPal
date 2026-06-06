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
