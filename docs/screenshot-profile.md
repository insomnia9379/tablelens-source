# Supplied Chumba blackjack profile

Both user-provided screenshots are landscape, 2404 × 1080 pixels. The reference files are kept locally in the source project. The labels below are manually transcribed observations, not output from the implemented OCR pipeline.

Screenshot 391 shows the player's 9 of diamonds and king of diamonds, displayed total 19, and the dealer's visible 9 of spades beside a hidden card. The balance is 50.19 SC and the wager is 0.5 SC. Hit, Stand, and Double controls are visible, but a static screenshot alone does not establish every control's enabled state. For ordinary blackjack, standing on this non-pair hard 19 is a suitable recommendation.

Screenshot 390 shows an empty betting table with a balance of 50.69 SC and wager 0 SC. Clear, Re-play, Play, and chip-selection controls are visible. It should produce no hand recommendation. No win, payout, or net profit is inferred from the difference between these two balances.

The table visibly states dealer hits on soft 17, blackjack pays 3:2, and insurance pays 2:1. Deck count, shuffle procedure, peek policy, double restrictions, split rules, surrender, and special automatic-winning-hand rules are not visible. The v1 engine deliberately abstains on rule-sensitive situations rather than silently assuming these settings.

The recognition adapter should crop to the green-table layout and use normalized regions. It must not recognize a fixture by filename or return these hand values when faced with an arbitrary image. Suits may remain unknown because this limited rank-based strategy does not require them.

The Android implementation is pending a real device build and recognition test. Unit tests of transcribed facts do not validate ML Kit accuracy. The operator's software-assisted-play restriction remains separate from the technical implementation.
