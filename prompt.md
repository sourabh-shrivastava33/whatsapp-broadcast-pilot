# Execution Prompt for Agent

You are working inside my WhatsApp Broadcast CRM repository.

Use the rules in `rules.md` as the operating contract. Read them first and follow them strictly.

## Primary objective

Make this product demo-ready and pilot-ready end to end.

The product must support this complete business story:

1. connect a business WABA account
2. discover and attach phone numbers
3. sync templates from Meta
4. create local templates
5. submit and track template approval
6. import and organize contacts
7. segment contacts into useful groups
8. send broadcasts using approved templates
9. track delivery results
10. capture replies
11. show follow-up and response status
12. show analytics and business outcomes
13. show audit trail and action history

## Working mode

You must work in very small steps.

For each step:

1. inspect relevant files
2. summarize what you found
3. propose a tiny implementation plan
4. implement only that step
5. run tests
6. verify the UI if the step touches frontend
7. report the result
8. stop and ask for permission before continuing

Do not proceed to the next step automatically.

## Required behavior

- Make no assumptions without checking the code.
- Preserve working functionality.
- Keep changes minimal and targeted.
- Add tests for every meaningful backend behavior.
- Check the UI after every frontend change.
- Fix obvious bad design, broken spacing, poor hierarchy, and confusing states.
- Do not mark a task complete until it is actually verified.

## Suggested milestone order

### Phase 1

Inspect the repo and identify:

- app structure
- data models
- backend routes
- frontend pages
- existing tests
- missing pieces for demo readiness

### Phase 2

Implement backend foundation:

- contact import
- contact dedupe
- tagging
- segmentation
- audit log
- analytics-ready fields

### Phase 3

Implement broadcast lifecycle:

- broadcast creation
- status tracking
- send result persistence
- retry / failure handling

### Phase 4

Implement replies and inbox:

- reply storage
- unified inbox data
- response status
- follow-up status

### Phase 5

Implement frontend demo surfaces:

- dashboard
- contacts
- segments
- broadcasts
- inbox
- analytics
- audit log

### Phase 6

Implement pilot mode:

- seeded demo data
- sample campaigns
- sample metrics
- guided setup
- clean empty states

### Phase 7

Final QA:

- run all tests
- fix failures
- inspect UI again
- identify anything that could confuse a prospect
- make the demo smooth

## For every completed step, report in this format

### Completed step

[short title]

### What changed

[clear summary]

### Files changed

[list files]

### Tests run

[list commands]

### Test result

[pass/fail and why]

### UI checked

[what screen or flow was reviewed]

### Issues found

[bugs or design problems]

### Next step recommendation

[one sentence]

Then stop and ask:
**Approve next step?**

## Quality bar

The final product must be good enough to present in a live demo without needing to explain missing basics.

The demo should show:

- business value
- clear workflow
- useful analytics
- operational reliability
- good visual polish

## Important constraints

- Do not introduce unrelated features.
- Do not rewrite the architecture unless required.
- Do not change the stack.
- Do not remove existing working flows.
- Do not skip tests.
- Do not skip UI review for visible screens.
- Do not continue after a milestone without permission.

## Definition of done for the whole repo

The project is ready only when:

- the full demo flow works
- the key screens are polished
- the product tells a clear revenue story
- test coverage exists for the core logic
- the pilot seed/demo data is ready
- the repo can be shown to a real broker prospect with confidence
