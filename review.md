Review only the modified files and commited changes in this branch.  
Produce the output as:
`review-YYYYMMDD-HHMM-<target>.md`

---

# 1. Performance

- [ ] Any unnecessary full-table scans or large data loads?
- [ ] Efficient loops and algorithmic complexity?
- [ ] Any blocking or synchronous I/O that may bottleneck?
- [ ] Potential CPU or memory hotspots?
- [ ] Appropriate caching and scalability considerations?
- [ ] Document reproduction steps + suggested optimizations if issues exist.

---

# 2. Security

- [ ] Authentication, authorization, and permission checks enforced?
- [ ] No secrets, tokens, or PII exposed?
- [ ] Proper input validation, sanitizing, and escaping?
- [ ] Secure handling of logs and outbound communications?
- [ ] XSS, CSRF, SQLi, SSRF, etc. mitigated?
- [ ] Describe potential attack scenarios + mitigations as needed.
- [ ] Correct use of `EnsureOfficeOwnership` middleware?

---

# 3. Readability & Maintainability

- [ ] Clear naming and intent?
- [ ] Duplicated or unreachable logic removed?
- [ ] Unused imports removed (frontend & backend)?
- [ ] Comments and documentation updated and concise?
- [ ] Good module boundaries and dependency structure?
- [ ] Follows coding standards (frontend & backend)?
- [ ] Aligns with Clean Code principles (frontend & backend)?

---

# 4. Data & Migration

- [ ] Migration handles existing data safely (defaults, backfills)?
- [ ] Rollbacks safe and idempotent?
- [ ] Schema updates maintain integrity and indexing?

---

# 5. Testing

- [ ] Unit/integration tests cover updated logic?
- [ ] Edge cases and error paths tested?

---

# 6. Operations & Monitoring

- [ ] Correct log levels (DEBUG/INFO/WARN/ERROR)?
- [ ] No sensitive data logged?
- [ ] Errors include context (stack traces, request IDs)?
- [ ] Log volume reasonable for production?
- [ ] Fail-safe and recovery paths handled?
- [ ] Audit logs present for critical actions?

---

### Filename Convention

```
review-YYYYMMDD-HHMM-<target>.md
```

- `YYYYMMDD-HHMM`: Review timestamp
- `<target>`: Target identifier
  - PR number: `pr123`
  - Branch name: `feature-auth`
  - Commit hash: `a1b2c3d`
  - File name: `auth-module`

Examples:

- `review-20250114-1430-pr123.md`
- `review-20250114-1430-feature-auth.md`
- `review-20250114-1430-auth-module.md`

### Review Report Format

- Finding: <Title>
  - Severity: High / Medium / Low
  - Location: <file:path#line>
  - Issue: <Description of the problem>
  - Impact: <Potential consequences>
  - Recommendation: <Suggested fix>
- Questions: <Clarifications needed>
- Residual Risks: <Remaining concerns or "None">
