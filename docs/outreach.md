# Creator outreach

Plain note to send a creator. Fill in the name and pick count; do not add anything the kit page does not show.

> Namaste <name>! Aapke <N> picks Indian Food Recommends par listed hain, har ek aapke video ke us moment se linked. Aapke liye ek share kit bana hai: story image, bio ke liye tracked link aur website badge. Yahan dekhiye: <SITE_URL>/creator/<slug>/kit. Koi pick hatana ho ya opt out karna ho, bas bata dijiye.

The kit page has a tracked bio link, a story image download, text for a video description (their total and top three places, straight from the DB), and a website badge with HTML and Markdown snippets in dark or light. Every link carries `utm_source=creator&utm_campaign=<slug>`; Umami shows those visits under `utm_source=creator`, and each copy fires `kit-copy` (see [metrics](metrics.md)).

## Sending a kit

1. Open `<SITE_URL>/creator/<slug>/kit` and check the count, the top places and the badge render. If a pick looks wrong, fix it in `/admin/review` first.
2. Copy the note above, fill in the name and the count from the kit page, and send it on the channel the creator lists for business (YouTube About page email or Instagram DM).
3. Fill in "contacted on" in the tracker below. Add the reply and whether they shared once you know.
4. If they ask to opt out, set `creators.opted_out = true` for that creator (the PRD promises within 7 days); the creator page, kit and badge return 404 after the next cache refresh.

The badge URL is `<SITE_URL>/creator/<slug>/badge` (`?theme=light` for the light version). It updates itself as picks are approved, so a creator never needs to re-paste it.

## Tracker

Placeholder host `https://indian-food-recommends.vercel.app`: swap for the live domain before sending. Contacted on, reply and shared? are for the owner to fill in (#42).

| creator                | channel | picks | kit link                                                                   | contacted on | reply | shared? |
| ---------------------- | ------- | ----- | -------------------------------------------------------------------------- | ------------ | ----- | ------- |
| FoodZpah               | YouTube | 53    | https://indian-food-recommends.vercel.app/creator/foodzpah/kit             |              |       |         |
| Spiceler               | YouTube | 41    | https://indian-food-recommends.vercel.app/creator/spiceler/kit             |              |       |         |
| Golgappa Girl          | YouTube | 39    | https://indian-food-recommends.vercel.app/creator/golgappa-girl/kit        |              |       |         |
| Food Venture Folks     | YouTube | 35    | https://indian-food-recommends.vercel.app/creator/food-venture-folks/kit   |              |       |         |
| Anagha Mirgal          | YouTube | 32    | https://indian-food-recommends.vercel.app/creator/anagha-mirgal/kit        |              |       |         |
| Safarkhana             | YouTube | 32    | https://indian-food-recommends.vercel.app/creator/safarkhana/kit           |              |       |         |
| Peppa Foodie           | YouTube | 30    | https://indian-food-recommends.vercel.app/creator/peppa-foodie/kit         |              |       |         |
| The Urban Guide        | YouTube | 28    | https://indian-food-recommends.vercel.app/creator/the-urban-guide/kit      |              |       |         |
| Pakoda Boyz            | YouTube | 25    | https://indian-food-recommends.vercel.app/creator/pakoda-boyz/kit          |              |       |         |
| Food Lovers TV         | YouTube | 22    | https://indian-food-recommends.vercel.app/creator/food-lovers-tv/kit       |              |       |         |
| Rocking Rasheed        | YouTube | 20    | https://indian-food-recommends.vercel.app/creator/rocking-rasheed/kit      |              |       |         |
| Srikanth Food & Travel | YouTube | 20    | https://indian-food-recommends.vercel.app/creator/srikanth-food-travel/kit |              |       |         |
| LeT'S Eat Folks        | YouTube | 19    | https://indian-food-recommends.vercel.app/creator/lets-eat-folks/kit       |              |       |         |
| Luv4FoodNTravel        | YouTube | 19    | https://indian-food-recommends.vercel.app/creator/luv4-food-n-travel/kit   |              |       |         |
| Unbox Karnataka        | YouTube | 16    | https://indian-food-recommends.vercel.app/creator/unbox-karnataka/kit      |              |       |         |
