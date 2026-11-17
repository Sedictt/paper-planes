-- Initial sky pool seed data (idempotent)
INSERT INTO planes (id, number, text, biome, time_of_day, paper_tint, stamp, reads, distance_km, flags, created_at)
VALUES
  ('plane-101', 101, 'I still keep the train ticket from the day we met in my winter coat pocket. You probably don''t even remember which platform it was.', 'Downtown Station', 'dusk', 'cream', 'PLATFORM 4', 28, 14.2, 0, NOW() - INTERVAL '2 hours'),
  ('plane-104', 104, 'To whoever catches this plane at night: unclench your jaw, drop your shoulders, and take a slow breath. You''re doing better than you think.', 'Seaside Boardwalk', 'midnight', 'sky', 'NIGHT WIND', 64, 31.8, 0, NOW() - INTERVAL '5 hours'),
  ('plane-109', 109, 'I finally handed in my resignation letter this morning. My hands were shaking at the crosswalk, but walking past the bakery felt like flying.', 'Market Crosswalk', 'morning', 'gold', 'FIRST DAY', 19, 8.5, 0, NOW() - INTERVAL '6 hours'),
  ('plane-115', 115, 'Sometimes I sit on my balcony just watching the timber-framed cottage windows light up one by one and wonder what everyone is cooking for dinner.', 'Cobblestone Village', 'evening', 'rose', 'HEARTH', 41, 22.0, 0, NOW() - INTERVAL '1 day'),
  ('plane-122', 122, 'I wish I had said ''stay a little longer'' instead of ''text me when you get home.''', 'Harbor Bridge', 'midnight', 'cream', 'UNSAID', 93, 47.6, 0, NOW() - INTERVAL '1 day'),
  ('plane-128', 128, 'Bought fresh peaches from the corner stall and sat by the valley waterfall for an hour with my phone in airplane mode. Best afternoon all month.', 'Valley Waterfall', 'afternoon', 'sage', 'VALLEY', 33, 19.4, 0, NOW() - INTERVAL '2 days'),
  ('plane-134', 134, 'If you''re unfolding this right now, I hope something unexpectedly gentle happens to you before the week ends.', 'Lighthouse Point', 'dawn', 'gold', 'DAYBREAK', 52, 39.1, 0, NOW() - INTERVAL '2 days'),
  ('plane-141', 141, 'I''m terrified of starting over in a new city at 28, even though staying where I was scared me way more.', 'Neon Arcade', 'evening', 'cream', 'ONE WAY', 37, 16.9, 0, NOW() - INTERVAL '3 days'),
  ('plane-149', 149, 'The rain on the terracotta roofs sounds like warm static on an old radio. Makes me miss childhood summers when nobody was in a rush.', 'Timber Square', 'dusk', 'sage', 'RAINY DAY', 29, 12.7, 0, NOW() - INTERVAL '3 days'),
  ('plane-156', 156, 'I forgive you, even though you never asked for it. I''m just tired of carrying it up every hill.', 'Pine Overlook', 'dawn', 'rose', 'LET GO', 71, 54.3, 0, NOW() - INTERVAL '4 days'),
  ('plane-163', 163, 'Saw a golden retriever carrying its own leash across the zebra crossing outside the convenience store today. 10/10 no notes.', 'Downtown Crossing', 'morning', 'gold', 'GOOD BOY', 84, 27.5, 0, NOW() - INTERVAL '4 days'),
  ('plane-170', 170, 'I hope one day we run into each other at the corner coffee shop and neither of us feels awkward anymore.', 'Corner Roastery', 'afternoon', 'cream', 'ESPRESSO', 44, 18.2, 0, NOW() - INTERVAL '5 days'),
  ('plane-178', 178, 'Made soup from scratch for the first time without calling my mom for the recipe. It actually tasted like hers.', 'Hillside Cottage', 'evening', 'rose', 'HOME', 59, 33.0, 0, NOW() - INTERVAL '5 days'),
  ('plane-185', 185, 'Watching the fireworks reflect on the harbor water by myself, wishing you were on the bench next to me.', 'Harbor Pier', 'midnight', 'sky', 'SPARK', 48, 25.6, 0, NOW() - INTERVAL '6 days'),
  ('plane-192', 192, 'Every paper plane drifting up here is a thought someone couldn''t keep inside anymore. I''m glad this sky is big enough for all of us.', 'Old Bell Tower', 'dusk', 'gold', 'FOREVER', 112, 68.4, 0, NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;
