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
