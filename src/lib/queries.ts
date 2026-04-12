import { gql } from "graphql-request";

export const USER_CARDS_QUERY = gql`
  query UserCards($slug: String!, $cursor: String, $first: Int = 50) {
    user(slug: $slug) {
      cards(first: $first, after: $cursor) {
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
          anyPlayer {
            slug
            displayName
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

// Fetches existing lineups for LIVE fixture (user already has contenders)
export const IN_SEASON_LIVE_QUERY = gql`
  query InSeasonLive($userSlug: String!) {
    so5 {
      so5Fixture(type: LIVE) {
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
                thresholdsStreakTask {
                  progress
                  target
                  thresholds {
                    score
                    current
                    rewardConfigs {
                      ... on MonetaryRewardConfig {
                        amount {
                          usdCents
                        }
                      }
                      ... on CoinRewardConfig {
                        amount
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
                    anyGame {
                      date
                      statusTyped
                      homeTeam {
                        code
                      }
                      awayTeam {
                        code
                      }
                    }
                  }
                }
                so5Rankings {
                  score
                  ranking
                }
              }
            }
          }
        }
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
            so5Lineup {
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
