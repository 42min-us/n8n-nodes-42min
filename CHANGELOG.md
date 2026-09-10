# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1]

### Fixed

- `author.email` is now `plus@42min.us`, the address the package is actually
  published from. It previously named a support address that was never a real
  mailbox, which matters because npm metadata is where tooling looks to reach a
  package owner: n8n's Creator Portal sends its ownership-verification token
  there.

## [0.1.0]

First release.

### Added

- **42min** node with four resources: Booking (create, get, get many, update,
  cancel, reschedule), Event Type (get, get many), Slot (get many, check) and
  User (get current).
- **42min Trigger** node covering all eight webhook events, registering and
  removing its own subscription as the workflow is activated and deactivated.
- **42min API** credential using a personal access token, with a credential
  test against `/v1/me` and an overridable base URL for self-hosted instances.
- HMAC verification of every webhook delivery, with a replay window, rejecting
  anything that fails before the workflow runs.
- Booking deliveries are reshaped into the flat, snake_case field names the REST
  API uses, so a trigger item and a lookup item read the same way.
- `Idempotency-Key` on every booking write, derived from the execution and item,
  with an optional override for keying on a stable value of your own.
- `If-Match` on booking updates, read from the booking immediately beforehand,
  so a concurrent edit fails loudly instead of being overwritten.
- Cursor pagination on Return All that carries the caller's filters through
  every page.

[Unreleased]: https://github.com/42min-us/n8n-nodes-42min/compare/0.1.1...HEAD
[0.1.1]: https://github.com/42min-us/n8n-nodes-42min/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/42min-us/n8n-nodes-42min/releases/tag/0.1.0
