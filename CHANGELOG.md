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
