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
