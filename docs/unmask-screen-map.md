# Product unmasking reference implementation

## Scope
White backgrounds, existing burgundy brand accent (#70323E), Boska display/General Sans UI, Phosphor icons. Product identity, source text, counts, categories, and replies are dynamic. Illustration badges and mock statistics are not production data.

| Supplied reference | Implemented destination |
| --- | --- |
| Unmask skincare search and scan screen-2 | `/unmask` — reference/Entry |
| Choose the right CeraVe cleanser | `/results?q=…` — dynamic search results |
| Unmask skincare product scan | `useScan` browser camera — real getUserMedia and upload alternatives |
| CeraVe product match confirmation | `useScan` match review — actual vision candidates |
| Confirm CeraVe Hydrating Facial Cleanser (both files) | `/product/[id]` — confirmation phase (duplicate reference) |
| Unmasking product research progress | `/product/[id]` — research phase driven by actual job status |
| CeraVe cleanser evidence at a glance | Overview |
| CeraVe hydration evidence overview | Overview → category drilldown |
| Unmask evidence feed for CeraVe | Evidence — mixed community/external feed and topic filters |
| CeraVe Cleanser External Discussion | Evidence external cards — source, parent comment, reply branch |
| CeraVe company profile | Company tab / About company from confirmation |
| Unmask product questions | Questions tab |
| Evidence-based cleanser answer | Questions → Ask → answer / missing evidence / service error |
| Review your CeraVe community question | `/product/[id]/ask-community` — compose + private draft |
| Review your skincare question before posting | Same route — explicit review phase |
| Community question: dry skin cleanser | `/thread/[id]?unmask=1` — persisted question and live replies |

## Existing services retained
- Search, preview, vision matching, research jobs, clips and product profile requests.
- Traceable eligible report counts and backend sufficiency gating; never convert an agreement score into a report percentage.
- Public experiences from both existing experience systems; private notes are not queried.
- Existing stored question/answer API and community thread/reply API.
- Follow subscriptions and local saved-product state.

## Publication boundary
Question/context is drafted locally until the explicit Post question action. Selected context is included in the persisted body. Changing the audience returns to the draft, which can be saved privately. There is no automatic community posting.

## Device scope
Custom camera composition is implemented for browser getUserMedia. Native Expo uses CameraView with the same custom frame and capture controls. Native builds need rebuilding after the camera plugin is added. Camera hardware, authenticated posting, and live provider responses require a permitted device/account during verification.
