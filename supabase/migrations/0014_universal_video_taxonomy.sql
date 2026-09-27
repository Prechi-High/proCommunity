-- Universal literacy-video taxonomy for any product category (Blueprint: universal_default template).
insert into public.category_tag_taxonomy (category, tag_key, tag_label, description, sort_order) values
  ('universal_default', 'how_it_works', 'How it works', 'Explains what the product does and why: the technology, mechanism or design, without being mainly a tutorial.', 1),
  ('universal_default', 'how_to_use', 'How to use', 'Setup, unboxing, installation, first use, settings or everyday use tips.', 2),
  ('universal_default', 'composition', 'What''s inside', 'Specs, materials, build quality, components or ingredients — what the product is made of.', 3),
  ('universal_default', 'who_its_for', 'Who it''s for', 'Whether it is worth buying and for which kind of person or use case.', 4),
  ('universal_default', 'results_over_time', 'Long-term', 'Long-term reviews, durability, months-later updates and how it holds up.', 5),
  ('universal_default', 'precautions', 'Watch out', 'Known problems, defects, safety issues, compatibility gotchas or reasons not to buy.', 6),
  ('universal_default', 'comparisons', 'Comparisons', 'Versus similar or alternative products and which option to pick.', 7)
on conflict do nothing;
