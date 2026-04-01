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
              pictureUrl
              domesticLeague {
                name
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
