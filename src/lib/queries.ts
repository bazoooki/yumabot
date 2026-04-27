import { gql } from "graphql-request";

export const USER_CARDS_QUERY = gql`
  query UserCards(
    $slug: String!
    $cursor: String
    $first: Int = 50
    $rarities: [Rarity!]
  ) {
    user(slug: $slug) {
      cards(first: $first, after: $cursor, rarities: $rarities) {
        nodes {
          slug
          rarityTyped
          pictureUrl
          seasonYear
          grade
          xp
          xpNeededForNextGrade
          inSeasonEligible
          cardEditionName
          power
          eligibleUpcomingLeagueTracks {
            entrySo5Leaderboard {
              seasonality
              so5LeaderboardType
              mainRarityType
              so5League {
                displayName
              }
            }
          }
          rawRecentSo5: rawSo5Scores(last: 5)
          anyPlayer {
            slug
            displayName
            avatarPictureUrl
            cardPositions
            age
            averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
            country {
              code
              name
              flagUrl
            }
            activeClub {
              slug
              name
              code
              pictureUrl
              domesticLeague {
                name
              }
              upcomingGames(first: 1) {
                date
                homeTeam {
                  code
                  name
                  pictureUrl
                }
                awayTeam {
                  code
                  name
                  pictureUrl
                }
                competition {
                  name
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

export const PLAYER_SCORES_QUERY = gql`
  query PlayerScores($slug: String!, $position: Position!) {
    anyPlayer(slug: $slug) {
      slug
      displayName
      allPlayerGameScores(first: 15, position: $position) {
        nodes {
          score
          scoreStatus
          projectedScore
          projection {
            grade
          }
          positionTyped
          anyGame {
            date
            homeTeam {
              code
              name
            }
            awayTeam {
              code
              name
            }
            competition {
              name
            }
            statusTyped
          }
          anyPlayerGameStats {
            ... on PlayerGameStats {
              fieldStatus
              footballPlayingStatusOdds {
                starterOddsBasisPoints
                reliability
              }
              minsPlayed
            }
          }
        }
      }
    }
  }
`;

export const PLAYER_STARTER_ODDS_QUERY = gql`
  query PlayerStarterOdds($slug: String!) {
    anyPlayer(slug: $slug) {
      slug
      activeClub {
        upcomingGames(first: 1) {
          playerGameScore(playerSlug: $slug) {
            scoreStatus
            projectedScore
            projection {
              grade
            }
            anyPlayerGameStats {
              ... on PlayerGameStats {
                fieldStatus
                footballPlayingStatusOdds {
                  starterOddsBasisPoints
                  reliability
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const LIVE_PLAYER_SCORES_QUERY = gql`
  query LivePlayerScores($slug: String!) {
    anyPlayer(slug: $slug) {
      slug
      activeClub {
        upcomingGames(first: 1) {
          date
          statusTyped
          homeTeam { code }
          awayTeam { code }
          playerGameScore(playerSlug: $slug) {
            score
            scoreStatus
            projectedScore
            anyPlayerGameStats {
              ... on PlayerGameStats {
                minsPlayed
                fieldStatus
              }
            }
          }
        }
      }
    }
  }
`;

export const UPCOMING_FIXTURE_QUERY = gql`
  query UpcomingFixture {
    so5 {
      so5Fixture(type: UPCOMING) {
        slug
        displayName
        gameWeek
        startDate
        endDate
        games {
          id
          date
          statusTyped
          sport
          homeScore
          awayScore
          homeTeam {
            code
            name
            slug
            pictureUrl
          }
          awayTeam {
            code
            name
            slug
            pictureUrl
          }
          competition {
            name
          }
        }
      }
    }
  }
`;

export const CURRENT_FIXTURE_QUERY = gql`
  query CurrentFixture {
    so5 {
      so5Fixture(type: LIVE) {
        slug
        displayName
        gameWeek
        startDate
        endDate
        games {
          id
          date
          statusTyped
          sport
          homeScore
          awayScore
          homeTeam {
            code
            name
            slug
            pictureUrl
          }
          awayTeam {
            code
            name
            slug
            pictureUrl
          }
          competition {
            name
          }
        }
      }
    }
  }
`;

// Shared body: everything inside `so5Fixture { ... }` for the lineups-per-user view.
// Used by both the LIVE query and the by-slug query (historical GWs).
const IN_SEASON_FIXTURE_BODY = `
    slug
    aasmState
    gameWeek
    endDate
    userFixtureResults(userSlug: $userSlug) {
      completedThresholdsStreakTasksCount
      so5LeaderboardContenders(first: 50) {
        nodes {
          slug
          so5Leaderboard {
            slug
            displayName
            division
            mainRarityType
            seasonality
            seasonalityName
            teamsCap
            cutOffDate
            iconUrl
            stadiumUrl
            canCompose {
              value
            }
            so5LeaderboardGroup {
              displayName
            }
            so5League {
              slug
              displayName
            }
          }
          so5Lineup {
            name
            draft
            canEdit
            rewardMultiplier
            hidden
            hasLiveGames
            completedTasks {
              id
              rewardConfigs {
                __typename
                ... on MonetaryRewardConfig {
                  amount {
                    usdCents
                  }
                }
                ... on CardShardRewardConfig {
                  rarity
                  quantity
                }
                ... on CoinRewardConfig {
                  amount
                }
                ... on CardRewardConfig {
                  rarity
                  gameplayTier
                }
              }
            }
            thresholdsStreakTask {
              progress
              target
              thresholds {
                score
                current
                rewardConfigs {
                  __typename
                  ... on MonetaryRewardConfig {
                    amount {
                      usdCents
                    }
                  }
                  ... on CoinRewardConfig {
                    amount
                  }
                  ... on CardShardRewardConfig {
                    rarity
                    quantity
                  }
                  ... on CardRewardConfig {
                    rarity
                    gameplayTier
                  }
                }
              }
              currentThreshold {
                score
              }
            }
            so5Appearances {
              index
              captain
              score
              status
              anyCard {
                slug
                rarityTyped
                pictureUrl
              }
              anyPlayer {
                displayName
                slug
                squaredPictureUrl
              }
              playerGameScore {
                score
                scoreStatus
                projectedScore
                projection {
                  grade
                }
                anyGame {
                  date
                  statusTyped
                  homeTeam {
                    code
                    pictureUrl
                  }
                  awayTeam {
                    code
                    pictureUrl
                  }
                }
              }
            }
            so5Rankings {
              score
              ranking
              eligibleOrSo5Rewards {
                __typename
                ... on So5Reward {
                  amount {
                    usdCents
                    referenceCurrency
                  }
                  coinAmount
                  rewardCards {
                    id
                    pictureUrl
                    quality
                    anyCard {
                      slug
                      rarityTyped
                    }
                  }
                  rewardConfigs {
                    __typename
                    ... on CardShardRewardConfig {
                      rarity
                      quantity
                    }
                  }
                }
                ... on So5RewardConfig {
                  fromRank
                  toRank
                  sharedPool
                  poolSize
                  usdAmount
                  coinAmount
                  cardShardRewardConfigs {
                    rarity
                    quantity
                  }
                  cards {
                    rarity
                    quantity
                    gameplayTier
                  }
                }
              }
            }
          }
        }
      }
    }
`;

// Fetches existing lineups for LIVE fixture (user already has contenders)
export const IN_SEASON_LIVE_QUERY = gql`
  query InSeasonLive($userSlug: String!) {
    so5 {
      so5Fixture(type: LIVE) {
        ${IN_SEASON_FIXTURE_BODY}
      }
    }
  }
`;

// Fetches a user's lineups for a specific past fixture (closed GW)
export const IN_SEASON_BY_FIXTURE_QUERY = gql`
  query InSeasonByFixture($userSlug: String!, $fixtureSlug: String!) {
    so5 {
      so5Fixture(slug: $fixtureSlug) {
        ${IN_SEASON_FIXTURE_BODY}
      }
    }
  }
`;

// Fetches all available in-season leaderboards for UPCOMING fixture (for building lineups)
export const IN_SEASON_UPCOMING_QUERY = gql`
  query InSeasonUpcoming {
    so5 {
      so5Fixture(type: UPCOMING) {
        slug
        aasmState
        gameWeek
        endDate
        so5Leagues {
          slug
          displayName
          iconUrl
          so5Leaderboards(notRooms: true) {
            slug
            displayName
            division
            mainRarityType
            seasonality
            seasonalityName
            teamsCap
            cutOffDate
            iconUrl
            stadiumUrl
            canCompose {
              value
            }
            so5LeaderboardGroup {
              displayName
            }
            so5League {
              slug
              displayName
            }
          }
        }
      }
    }
  }
`;

// Lists fixtures (metadata only) so the route can pick the in-season window.
// Sorare returns these in descending order and rejects `so5Leagues` inside
// a connection — so leaderboards are fetched per-fixture via
// IN_SEASON_FIXTURE_LEAGUES_QUERY below. We deliberately do NOT pass an
// aasmStates filter here — the default (all except preparing/cancelled)
// gives us both the in-progress fixture and the upcoming ones, and we sort
// + cut down by endDate in the route.
export const IN_SEASON_UPCOMING_LIST_QUERY = gql`
  query InSeasonUpcomingList($first: Int!) {
    so5 {
      so5Fixtures(first: $first, sport: FOOTBALL) {
        nodes {
          slug
          aasmState
          gameWeek
          endDate
        }
      }
    }
  }
`;

// Per-fixture leaderboards — used to enumerate in-season comps for a given
// fixture slug. Companion to IN_SEASON_UPCOMING_LIST_QUERY.
export const IN_SEASON_FIXTURE_LEAGUES_QUERY = gql`
  query InSeasonFixtureLeagues($slug: String!) {
    so5 {
      so5Fixture(slug: $slug) {
        slug
        aasmState
        gameWeek
        endDate
        so5Leagues {
          slug
          displayName
          iconUrl
          so5Leaderboards(notRooms: true) {
            slug
            displayName
            division
            mainRarityType
            seasonality
            seasonalityName
            teamsCap
            cutOffDate
            iconUrl
            stadiumUrl
            canCompose {
              value
            }
            so5LeaderboardGroup {
              displayName
            }
            so5League {
              slug
              displayName
            }
          }
        }
      }
    }
  }
`;

export const GAME_DETAIL_QUERY = gql`
  query GameDetail($gameId: ID!) {
    anyGame(id: $gameId) {
      id
      date
      statusTyped
      ... on Game {
        minute
        periodType
      }
      homeScore
      awayScore
      homeTeam {
        code
        name
        slug
        pictureUrl
      }
      awayTeam {
        code
        name
        slug
        pictureUrl
      }
      competition {
        name
      }
      playerGameScores {
        score
        scoreStatus
        projectedScore
        positionTyped
        anyPlayer {
          slug
          displayName
          squaredPictureUrl
          activeClub {
            code
          }
        }
        anyPlayerGameStats {
          ... on PlayerGameStats {
            minsPlayed
            fieldStatus
          }
        }
        detailedScore {
          category
          stat
          statValue
          totalScore
          points
        }
        ... on PlayerGameScore {
          positiveDecisiveStats {
            category
            stat
            statValue
            totalScore
            points
          }
          negativeDecisiveStats {
            category
            stat
            statValue
            totalScore
            points
          }
        }
      }
    }
  }
`;

// --- Results / Leaderboard queries ---

export const FIXTURE_LEADERBOARDS_QUERY = gql`
  query FixtureLeaderboards($type: So5State!) {
    so5 {
      so5Fixture(type: $type) {
        slug
        gameWeek
        aasmState
        endDate
        so5Leagues {
          slug
          displayName
          so5Leaderboards(notRooms: true) {
            slug
            displayName
            division
            mainRarityType
            seasonality
            isArena
            so5LineupsCount
            so5League {
              slug
              displayName
            }
            so5LeaderboardGroup {
              displayName
            }
          }
        }
      }
    }
  }
`;

export const PAST_FIXTURES_LIST_QUERY = gql`
  query PastFixtures($first: Int!) {
    so5 {
      so5Fixtures(first: $first, sport: FOOTBALL, aasmStates: ["closed", "started", "playing"]) {
        nodes {
          slug
          gameWeek
          aasmState
          endDate
        }
      }
    }
  }
`;

export const FIXTURE_LEADERBOARDS_BY_SLUG_QUERY = gql`
  query FixtureLeaderboardsBySlug($slug: String!) {
    so5 {
      so5Fixture(slug: $slug) {
        slug
        gameWeek
        aasmState
        endDate
        so5Leagues {
          slug
          displayName
          so5Leaderboards(notRooms: true) {
            slug
            displayName
            division
            mainRarityType
            seasonality
            isArena
            so5LineupsCount
            so5League {
              slug
              displayName
            }
            so5LeaderboardGroup {
              displayName
            }
          }
        }
      }
    }
  }
`;

// Keep this query lean — Sorare caps GraphQL complexity at 30,000 per request,
// and every field inside `nodes` is multiplied by pageSize (50) + nested list
// depths. Anything that isn't essential for per-user $ / essence aggregation
// is fetched via a separate one-shot query.
export const LEADERBOARD_RANKINGS_QUERY = gql`
  query LeaderboardRankings($slug: String!, $page: Int!, $pageSize: Int!) {
    so5 {
      so5Leaderboard(slug: $slug) {
        slug
        so5RankingsPaginated(page: $page, pageSize: $pageSize) {
          currentPage
          pages
          totalCount
          nodes {
            ranking
            score
            user {
              slug
              nickname
              pictureUrl
            }
            eligibleOrSo5Rewards {
              __typename
              ... on So5Reward {
                amount {
                  usdCents
                }
                coinAmount
                rewardConfigs {
                  __typename
                  ... on CardShardRewardConfig {
                    rarity
                    quantity
                  }
                }
              }
              ... on So5RewardConfig {
                fromRank
                toRank
                usdAmount
                coinAmount
                cardShardRewardConfigs {
                  rarity
                  quantity
                }
              }
            }
            so5Lineup {
              completedTasks {
                id
                rewardConfigs {
                  __typename
                  ... on MonetaryRewardConfig {
                    amount {
                      usdCents
                    }
                  }
                  ... on CardShardRewardConfig {
                    rarity
                    quantity
                  }
                }
              }
              so5Appearances {
                index
                captain
                score
                position
                anyPlayer {
                  slug
                  displayName
                }
                anyCard {
                  slug
                }
              }
            }
          }
        }
      }
    }
  }
`;

// One-shot query for the streak thresholds of a leaderboard.
// Returns just the first ranking's lineup's ThresholdsStreakTask — thresholds
// are identical for every user in the same leaderboard, so one sample suffices.
// Kept tiny (pageSize: 1) to stay well under the GraphQL complexity cap.
export const LEADERBOARD_STREAK_QUERY = gql`
  query LeaderboardStreak($slug: String!) {
    so5 {
      so5Leaderboard(slug: $slug) {
        slug
        so5RankingsPaginated(page: 1, pageSize: 1) {
          nodes {
            so5Lineup {
              thresholdsStreakTask {
                progress
                target
                thresholds {
                  score
                  current
                  rewardConfigs {
                    __typename
                    ... on MonetaryRewardConfig {
                      amount {
                        usdCents
                      }
                    }
                    ... on CardShardRewardConfig {
                      rarity
                      quantity
                    }
                    ... on CoinRewardConfig {
                      amount
                    }
                    ... on CardRewardConfig {
                      rarity
                      gameplayTier
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Enumerates all in-season leaderboards for the UPCOMING GW. We fetch this
// separately from IN_SEASON_LIVE_QUERY so the Hot Streaks panel can show
// competitions the user hasn't entered yet — streak state comes from the live
// fetch and is merged client-side.
//
// Note: the `myThresholdsStreakTask` field on So5LeagueTrack requires session
// auth (not APIKEY) and is therefore intentionally omitted here.
export const MY_IN_SEASON_STREAKS_QUERY = gql`
  query MyInSeasonStreaks {
    so5 {
      so5Fixture(type: UPCOMING) {
        slug
        gameWeek
        endDate
        aasmState
        so5Leagues {
          slug
          displayName
          iconUrl
          so5Leaderboards(notRooms: true) {
            slug
            displayName
            division
            mainRarityType
            seasonality
            iconUrl
            so5LeaderboardGroup {
              displayName
            }
            so5League {
              slug
              displayName
            }
          }
        }
      }
    }
  }
`;
