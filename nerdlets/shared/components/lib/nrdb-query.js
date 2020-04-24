import {NerdGraphQuery} from 'nr1'

export default async function nrdbQuery(accountId, nrql) {
  const gql = `{
    actor {
      account(id: ${accountId}) {
        nrql(query: "${nrql}") {
          results
        }
      }
    }
  }`

  const {data, error} = await NerdGraphQuery.query({query: gql})
  if(error) {
    throw "Bad NRQL Query: " + nrql + ": " + error
  }
  return data.actor.account.nrql.results
}
