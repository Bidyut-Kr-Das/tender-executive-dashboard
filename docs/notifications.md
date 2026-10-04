# Tender notifications (removed)

WhatsApp notifications were sent through a self-hosted Evolution API container
(`evoapicloud/evolution-api`). The integration, the four notification routes and
their Kestra flows were removed. This page records what was sent, to whom and
when, so the feature can be rebuilt on another channel.

## How it worked

- Each notification type had its own route: `POST /api/notifications/<type>`.
  The routes were protected by `requireApiKey` (Kestra external API key) and
  wrapped with `withLog`.
- Kestra flows (`kestra/flows/main_scheduler.notification*.yml`) were meant to
  call each route on a schedule. All flows were already commented out before
  removal, so nothing was sending in production.
- Each route queried `TenderMerged`, rendered one Handlebars text message per
  matching tender and sent it to a single recipient (a phone number or WhatsApp
  group JID) taken from an env var.
- After a successful send, the type key was appended to the comma-separated
  `TenderMerged.notificationStatus` column, so a tender got each type only once.
  The column still exists in the schema.
- All types ignored tenders with `deadline <= 2026-07-20T00:00:00Z`
  (`NOTIFICATION_DEADLINE_START`).

## Notification types

### 1. Result declared

- Key: `deadline_over_result_notification`
- Recipient env var: `EVOLUTION_RESULT_NOTIFICATION_NUMBER`
- Trigger: all of
  - deadline has passed (`deadline <= now`)
  - `apm = "YES"`
  - `competitors`, `ourRank`, `ourValue` are all non-empty
  - type key not yet in `notificationStatus`
- Message:
  ```
  Result Declared

  Tender No: {referenceNo}
  Tender: {tenderBrief}
  Organization: {organization}
  Deadline: {deadline, dd MMM yyyy}

  Rank: {ourRank}
  Our Value: {ourValue}
  Competitors: {competitors}
  ```

### 2. Deadline over, not participated

- Key: `deadline_over_not_participated_notification`
- Recipient env var: `EVOLUTION_NOT_PARTICIPATED_NOTIFICATION_NUMBER`
- Trigger: all of
  - deadline has passed
  - `apm = "YES"`
  - `participated = false`
  - `reason` is non-empty
  - type key not yet in `notificationStatus`
- Message:
  ```
  Deadline Over - Not Participated

  Tender No: {referenceNo}
  Tender: {tenderBrief}
  Organization: {organization}
  Deadline: {deadline, dd MMM yyyy}

  Reason: {reason}
  ```

### 3. Deadline over, reason not provided

- Key: `deadline_over_reason_not_provided_notification`
- Recipient env var: `EVOLUTION_REASON_NOT_PROVIDED_NOTIFICATION_NUMBER`
- Trigger: all of
  - deadline has passed
  - `apm = "YES"`
  - `participated` is `false` or `null`
  - `reason` is `null` or empty
  - type key not yet in `notificationStatus`
- Message:
  ```
  Deadline Over - Reason Required

  Tender No: {referenceNo}
  Tender: {tenderBrief}
  Organization: {organization}
  Deadline: {deadline, dd MMM yyyy}

  Please provide the reason for not participating.
  ```

### 4. Catalogue missing (upcoming deadline)

- Key: `deadline_over_catalogue_missing_notification`
- Recipient env var: `EVOLUTION_CATALOGUE_MISSING_NOTIFICATION_NUMBER`
- Trigger: all of
  - `tenderType = "GEM"`
  - `apm = "YES"`
  - `participated` is `null`
  - `catalogueDone = "NOT_DECIDED"`
  - deadline is within the next 7 days (`now <= deadline <= now + 7d`)
  - type key not yet in `notificationStatus`
- Note: this route never wrote its key to `notificationStatus`, so a tender
  would be re-sent on every run until it stopped matching.
- Message (`daysToDeadline` = days until deadline, rounded up, minimum 1):
  ```
  Catalogue Missing

  Tender No: {referenceNo}
  Tender: {tenderBrief}
  Organization: {organization}
  Deadline: {deadline, dd MMM yyyy} (in {daysToDeadline} days)

  Please complete the catalogue before the deadline.
  ```
