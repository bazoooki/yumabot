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
  query PlayerScores($slug: String!, $position: String!) {
    anyPlayer(slug: $slug) {
      slug
      displayName
      allPlayerGameScores(first: 15, position: $position) {
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
          status
        }
        anyPlayerGameStats {
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
