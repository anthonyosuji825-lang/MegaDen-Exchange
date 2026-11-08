// lib/boost/catalog.js
//
// The curated, human-decided mapping of what we sell to which provider
// service ID. This file answers "WHAT do we sell and where does it come
// from" — it never holds a price, a rate, a min, or a max. Those are live
// facts owned by the provider and are looked up from boost_services in
// the database (kept fresh by scripts/sync-provider-services.mjs), never
// hardcoded here. That's what makes pricing dynamic: change a provider's
// price or limits, and the next sync picks it up with zero code changes.
//
// Every entry here was verified against the provider's live service list
// during the September 2026 catalog audit — see /areas/megaden-exchange
// notes for the reasoning behind each pick where more than one candidate
// existed.
//
// `code` must be unique and match the primary key in boost_services.

export const CATALOG = [
  // ---------------------------------------------------------------- Instagram
  { code: 'ig_followers',    platform: 'instagram', tier: 'standard', provider: 'jap', providerServiceId: 10129, label: 'Followers' },
  { code: 'ig_likes',        platform: 'instagram', tier: 'standard', provider: 'jap', providerServiceId: 6562,  label: 'Likes' },
  { code: 'ig_views',        platform: 'instagram', tier: 'standard', provider: 'jap', providerServiceId: 3008,  label: 'Views' },
  { code: 'ig_followers_avg', platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3106, label: 'Followers', quality: 'avg' },
  { code: 'ig_followers_hq',  platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3107, label: 'Followers', quality: 'hq' },
  { code: 'ig_likes_avg',     platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2997, label: 'Likes', quality: 'avg' },
  { code: 'ig_likes_hq',      platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2998, label: 'Likes', quality: 'hq' },
  { code: 'ig_views_avg',     platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3108, label: 'Views', quality: 'avg' },
  { code: 'ig_views_hq',      platform: 'instagram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3109, label: 'Views', quality: 'hq' },

  // ------------------------------------------------------------------ TikTok
  { code: 'tt_followers',    platform: 'tiktok', tier: 'standard', provider: 'jap', providerServiceId: 10127, label: 'Followers' },
  { code: 'tt_likes',        platform: 'tiktok', tier: 'standard', provider: 'jap', providerServiceId: 10022, label: 'Likes' },
  { code: 'tt_views',        platform: 'tiktok', tier: 'standard', provider: 'jap', providerServiceId: 10168, label: 'Views' },
  { code: 'tt_followers_avg', platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3036, label: 'Followers', quality: 'avg' },
  { code: 'tt_followers_hq',  platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3037, label: 'Followers', quality: 'hq' },
  { code: 'tt_likes_avg',     platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3048, label: 'Likes', quality: 'avg' },
  { code: 'tt_likes_hq',      platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3049, label: 'Likes', quality: 'hq' },
  { code: 'tt_views_avg',     platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3047, label: 'Views', quality: 'avg' },
  { code: 'tt_views_hq',      platform: 'tiktok', tier: 'turbo', provider: 'exobooster', providerServiceId: 3043, label: 'Views', quality: 'hq' },

  // ---------------------------------------------------------------- Twitter/X
  { code: 'tw_followers',    platform: 'twitter', tier: 'standard', provider: 'jap', providerServiceId: 9276,  label: 'Followers' },
  { code: 'tw_likes',        platform: 'twitter', tier: 'standard', provider: 'jap', providerServiceId: 10184, label: 'Likes' },
  { code: 'tw_retweets',     platform: 'twitter', tier: 'standard', provider: 'jap', providerServiceId: 7974,  label: 'Retweets' },

  // --------------------------------------------------------------- Facebook
  { code: 'fb_page_likes',       platform: 'facebook', tier: 'standard', provider: 'jap', providerServiceId: 1882, label: 'Page Likes' },
  { code: 'fb_followers',        platform: 'facebook', tier: 'standard', provider: 'jap', providerServiceId: 1889, label: 'Followers' },
  { code: 'fb_post_likes',       platform: 'facebook', tier: 'standard', provider: 'jap', providerServiceId: 9541, label: 'Post Likes' },
  { code: 'fb_page_followers_avg',    platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3123, label: 'Page Followers', quality: 'avg' },
  { code: 'fb_page_followers_hq',     platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3124, label: 'Page Followers', quality: 'hq' },
  { code: 'fb_profile_followers_avg', platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3125, label: 'Profile Followers', quality: 'avg' },
  { code: 'fb_profile_followers_hq',  platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3126, label: 'Profile Followers', quality: 'hq' },
  { code: 'fb_post_likes_avg',        platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3129, label: 'Post Likes', quality: 'avg' },
  { code: 'fb_post_likes_hq',         platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3130, label: 'Post Likes', quality: 'hq' },
  { code: 'fb_reaction_love',   platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3131, label: 'Reaction: Love' },
  { code: 'fb_reaction_wow',    platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3132, label: 'Reaction: Wow' },
  { code: 'fb_reaction_haha',   platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3133, label: 'Reaction: Haha' },
  { code: 'fb_reaction_sad',    platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3134, label: 'Reaction: Sad' },
  { code: 'fb_reaction_angry',  platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3135, label: 'Reaction: Angry' },
  { code: 'fb_post_shares',     platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 2975, label: 'Post Shares' },
  { code: 'fb_group_members_avg', platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 2932, label: 'Group Members', quality: 'avg' },
  { code: 'fb_group_members_hq',  platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3136, label: 'Group Members', quality: 'hq' },
  { code: 'fb_video_views_avg', platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3137, label: 'Video Views', quality: 'avg' },
  { code: 'fb_video_views_hq',  platform: 'facebook', tier: 'turbo', provider: 'exobooster', providerServiceId: 3138, label: 'Video Views', quality: 'hq' },

  // ---------------------------------------------------------------- YouTube
  { code: 'yt_subscribers',  platform: 'youtube', tier: 'standard', provider: 'jap', providerServiceId: 3519,  label: 'Subscribers' },
  { code: 'yt_views',        platform: 'youtube', tier: 'standard', provider: 'jap', providerServiceId: 10236, label: 'Views' },
  { code: 'yt_likes',        platform: 'youtube', tier: 'standard', provider: 'jap', providerServiceId: 2085,  label: 'Likes' },
  { code: 'yt_subscribers_avg', platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3056, label: 'Subscribers', quality: 'avg' },
  { code: 'yt_subscribers_hq',  platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3058, label: 'Subscribers', quality: 'hq' },
  { code: 'yt_views_avg',       platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3061, label: 'Views', quality: 'avg' },
  { code: 'yt_views_hq',        platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3062, label: 'Views', quality: 'hq' },
  { code: 'yt_likes_avg',       platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3080, label: 'Likes', quality: 'avg' },
  { code: 'yt_likes_hq',        platform: 'youtube', tier: 'turbo', provider: 'exobooster', providerServiceId: 3149, label: 'Likes', quality: 'hq' },

  // --------------------------------------------------------------- Telegram
  { code: 'tg_members',      platform: 'telegram', tier: 'standard', provider: 'jap', providerServiceId: 7330, label: 'Members' },
  { code: 'tg_post_views',   platform: 'telegram', tier: 'standard', provider: 'jap', providerServiceId: 6583, label: 'Post Views' },
  { code: 'tg_members_avg',  platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3143, label: 'Members', quality: 'avg' },
  { code: 'tg_members_hq',   platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 3144, label: 'Members', quality: 'hq' },
  { code: 'tg_post_views_turbo', platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2801, label: 'Post Views' },
  // tb_tg_autoviews (service 2804) is intentionally NOT listed here: it is
  // type "Subscriptions" on Exobooster and needs different order fields
  // than link+quantity. Add it once a subscription-style order flow exists.
  { code: 'tg_reaction_positive', platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2733, label: 'Reaction: Positive' },
  { code: 'tg_reaction_negative', platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2734, label: 'Reaction: Negative' },
  { code: 'tg_reaction_heart',    platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2735, label: 'Reaction: ❤️' },
  { code: 'tg_reaction_fire',     platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2736, label: 'Reaction: 🔥' },
  { code: 'tg_reaction_laugh',    platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2737, label: 'Reaction: 🤣' },
  { code: 'tg_reaction_thumbsup', platform: 'telegram', tier: 'turbo', provider: 'exobooster', providerServiceId: 2738, label: 'Reaction: 👍' },

  // --------------------------------------------------------------- Spotify
  { code: 'sp_plays_ios',     platform: 'spotify', tier: 'standard', provider: 'jap', providerServiceId: 8430, label: 'Plays (iOS)' },
  { code: 'sp_plays_android', platform: 'spotify', tier: 'standard', provider: 'jap', providerServiceId: 8431, label: 'Plays (Android)' },

  // -------------------------------------------------------------- Snapchat
  { code: 'sc_followers_arab',        platform: 'snapchat', tier: 'standard', provider: 'jap', providerServiceId: 4165, label: 'Followers (Arab Gulf)' },
  { code: 'sc_followers_arab_alt',    platform: 'snapchat', tier: 'standard', provider: 'jap', providerServiceId: 6859, label: 'Followers (Arab)' },

  // -------------------------------------------------------------- WhatsApp
  // JAP only sells WhatsApp *Channel* services (members + post reactions);
  // there is no group-member or post-view service to offer.
  { code: 'wa_members',        platform: 'whatsapp', tier: 'standard', provider: 'jap', providerServiceId: 9278, label: 'Channel Members (Worldwide)' },
  { code: 'wa_members_ng',     platform: 'whatsapp', tier: 'standard', provider: 'jap', providerServiceId: 9289, label: 'Channel Members (Nigeria)' },
  { code: 'wa_reactions',      platform: 'whatsapp', tier: 'standard', provider: 'jap', providerServiceId: 9290, label: 'Post Reactions (Mix)' },
  { code: 'wa_reaction_like',  platform: 'whatsapp', tier: 'standard', provider: 'jap', providerServiceId: 9291, label: 'Post Reactions: 👍' },
  { code: 'wa_reaction_love',  platform: 'whatsapp', tier: 'standard', provider: 'jap', providerServiceId: 9292, label: 'Post Reactions: ❤️' },
]

export function servicesForTier(tier) {
  return CATALOG.filter(s => s.tier === tier)
}

export function findService(code) {
  return CATALOG.find(s => s.code === code) || null
}

export function platformsForTier(tier) {
  const seen = new Set()
  const out = []
  for (const s of CATALOG) {
    if (s.tier !== tier) continue
    if (seen.has(s.platform)) continue
    seen.add(s.platform)
    out.push(s.platform)
  }
  return out
}