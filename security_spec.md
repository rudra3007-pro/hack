# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Baseline**: Any unlisted path (including `/test/connection`) returns `PERMISSION_DENIED`.
2. **Owner-Only Profile & PII Isolation**: `/users/{userId}` and `/users/{userId}/private/{docId}` can only be read (`get`), created, or updated by the verified authenticated user whose `request.auth.uid == userId`. List queries on `/users` and `/private` are forbidden (`allow list: if false`).
3. **Privilege Escalation Prevention**: `UserProfile.role` is strictly constrained to `'commuter'`; users cannot self-assign elevated roles.
4. **Master Gate on Subcollections**: `/users/{userId}/savedRoutes/{routeId}` requires `get(/databases/$(database)/documents/users/$(userId)).data.uid == request.auth.uid` on single-document operations (`get`, `create`, `update`, `delete`), and enforces `resource.data.userId == request.auth.uid` on `list`.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`; `updatedAt` must equal `request.time`. `uid` and `userId` are immutable after creation.
6. **Feedback Isolation**: `/feedback/{feedbackId}` allows verified users to create immutable records bound to `request.auth.uid` and read/list only their own records (`resource.data.userId == request.auth.uid`).

## 2. Adversarial "Dirty Dozen" Payloads
1. Unauthenticated read on `/users/alice`: `PERMISSION_DENIED`.
2. Authenticated user `bob` reading `/users/alice` or `/users/alice/private/pii`: `PERMISSION_DENIED`.
3. `list` query on `/users`: `PERMISSION_DENIED`.
4. Unverified email account writing to `/users/bob`: `PERMISSION_DENIED`.
5. Creating `/users/bob` with `role: "admin"`: `PERMISSION_DENIED`.
6. Shadow field injection `{ ...validProfile, isVerifiedAdmin: true }`: `PERMISSION_DENIED` (`hasOnly` rejects).
7.Spoofing `uid: "alice"` while authenticated as `"bob"`: `PERMISSION_DENIED`.
8. Oversized `displayName` (> 80 chars) or oversized document ID (> 128 chars): `PERMISSION_DENIED`.
9. Client-forged timestamp `{ ...validProfile, createdAt: "2020-01-01T00:00:00Z" }`: `PERMISSION_DENIED`.
10. Updating `createdAt` or `uid` on `/users/bob`: `PERMISSION_DENIED`.
11. Creating `/users/bob/savedRoutes/r1` without an existing `/users/bob` parent doc: `PERMISSION_DENIED`.
12. Querying `/feedback` without `where('userId', '==', request.auth.uid)`: `PERMISSION_DENIED`.
