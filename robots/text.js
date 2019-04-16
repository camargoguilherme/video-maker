const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')

const watsonApikey = require('../credentials/watson-nlu.json').apikey
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1.js')
 
var nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApikey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
});

async function robot(content){
  await fecthContentFromWikipedia(content)
  sanitizeContent(content)
  breakContentIntoSentences(content)
  limitMaximumSentences(content)
  await fetchKeywordsOfAllSentences(content)

  async function fecthContentFromWikipedia(){
    const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey)
    const wikipediaAlgorithmia = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2')
    const wikipediaResponse = await wikipediaAlgorithmia.pipe(content.searchTerm)
    const wikipediaContent = wikipediaResponse.get()
    content.sourceContentOriginal = wikipediaContent.content
  }

  function sanitizeContent(content){
    const withoutBlankLinesAndMarkDown = removeBrankLinesAndMarkDown(content.sourceContentOriginal)
    const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkDown)
    content.sourceContentSanitized = withoutDatesInParentheses
    function removeBrankLinesAndMarkDown(text){
      const allLines = text.split('\n')

      const withoutBlankLinesAndMarkDown = allLines.filter( (line) => {
        if(line.trim().length === 0 || line.trim().startsWith('=')){
          return false
        }
        return true
      })
      return withoutBlankLinesAndMarkDown.join(' ')
    }

    function removeDatesInParentheses(text){
      return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace( /  /g, ' ')
    }
  }

  function breakContentIntoSentences(content){
    content.sentences = []
    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    
    sentences.forEach( (sentence) => {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: []
      })
    })
  }

  function limitMaximumSentences(content){
    content.sentences = content.sentences.slice(0, content.maximumSentences)
  }

  async function fetchKeywordsOfAllSentences(content){
    for( const sentence of content.sentences){
      sentence.keyword = await fetchWatsonAndReturnKeywords(sentence.text)
    }
  }

  async function fetchWatsonAndReturnKeywords(sentence){
    return new Promise( (resolve, reject) => {
      nlu.analyze({
        text: sentence,
        features:{
          keywords:{}
        }
      }, (error, response) =>{
        if(error){
          throw error
        }
        const keywords = response.keywords.map( (keyword) => {
          return keyword.text
        })
        
        resolve(keywords)
      })
    })
  }

}

module.exports = robot