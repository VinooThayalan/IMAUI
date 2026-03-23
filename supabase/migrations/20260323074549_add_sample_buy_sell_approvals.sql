/*
  # Add Sample Data for Buy and Sell Approvals

  ## Summary
  Inserts realistic sample approval records for the buy_sell_approvals table.

  ## Records Added
  - 10 approval records linked to existing buy/sell notes
  - Covers all status types: Pending, Approved, Rejected, On Hold
  - Priority values: Low, Medium, High (per constraint)
  - Includes reviewed records (with reviewer, date, remarks) and pending ones
*/

INSERT INTO buy_sell_approvals (id, buy_sell_note_id, status, submitted_by, submitted_date, reviewed_by, reviewed_date, remarks, priority, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'f51ab446-315c-4977-8df9-187988b7bce3',
    'Approved',
    'Kasun Perera',
    NOW() - INTERVAL '15 days',
    'Malith Fernando',
    NOW() - INTERVAL '14 days',
    'All documentation verified. Transaction approved for processing.',
    'High',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '14 days'
  ),
  (
    gen_random_uuid(),
    '6a6de8de-8a9c-4655-848f-19f8c64d9c3f',
    'Approved',
    'Nirosha Wickramasinghe',
    NOW() - INTERVAL '12 days',
    'Malith Fernando',
    NOW() - INTERVAL '11 days',
    'Approved. Broker confirmation received and CDS details verified.',
    'Medium',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '11 days'
  ),
  (
    gen_random_uuid(),
    '9101dfa2-f937-4138-8633-c9301bc6c15c',
    'Rejected',
    'Tharaka Jayawardena',
    NOW() - INTERVAL '10 days',
    'Malith Fernando',
    NOW() - INTERVAL '9 days',
    'Rejected due to incomplete supporting documents. Please resubmit with all required attachments.',
    'Medium',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    gen_random_uuid(),
    '121f2cad-0de5-4b57-b5e8-650c833a6d22',
    'Pending',
    'Kasun Perera',
    NOW() - INTERVAL '7 days',
    NULL,
    NULL,
    NULL,
    'High',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    gen_random_uuid(),
    '087a541b-68d4-4808-8832-348265b98ba0',
    'On Hold',
    'Nirosha Wickramasinghe',
    NOW() - INTERVAL '6 days',
    'Samanthi Rathnayake',
    NOW() - INTERVAL '5 days',
    'On hold pending clarification from broker on settlement terms.',
    'High',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    gen_random_uuid(),
    '4dfff2b4-c53f-4683-8329-c7c73322c8a7',
    'Pending',
    'Tharaka Jayawardena',
    NOW() - INTERVAL '4 days',
    NULL,
    NULL,
    NULL,
    'Low',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(),
    '5d1ba713-fc86-46d5-a247-5c23432e66c5',
    'Approved',
    'Kasun Perera',
    NOW() - INTERVAL '3 days',
    'Samanthi Rathnayake',
    NOW() - INTERVAL '2 days',
    'Verified against transaction record. Approved.',
    'Medium',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    '50233439-fb0a-490c-b7ed-4ce1e11f778c',
    'Pending',
    'Nirosha Wickramasinghe',
    NOW() - INTERVAL '2 days',
    NULL,
    NULL,
    NULL,
    'High',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    '21efbbd1-cba5-4093-8210-b7146e8ceb95',
    'On Hold',
    'Tharaka Jayawardena',
    NOW() - INTERVAL '1 day',
    'Malith Fernando',
    NOW() - INTERVAL '12 hours',
    'Awaiting compliance sign-off before final approval.',
    'High',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '12 hours'
  ),
  (
    gen_random_uuid(),
    'f0bb62da-b31c-4220-b1e4-eacca3fb8f2c',
    'Pending',
    'Kasun Perera',
    NOW() - INTERVAL '3 hours',
    NULL,
    NULL,
    NULL,
    'Medium',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
  );
