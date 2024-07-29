const OpenAI = require("openai");
const {ai_key} = require("../../../config.json");
const db = require("../dbHandlers/dbHandler.js")

const openAIClient = new OpenAI({
    apiKey: ai_key
})

/**
 * sends prompt to gpt-3.5 and retrieves the result
 * saves the result to db while respecting the phase of the active round
 * 
 * @param {*} prompt prompt that the player sent
 * @param {*} creator the player that sent this prompt
 * @param {*} session the session the player part of
 * @param {*} round the round the player was in while sending the prompt
 */
async function processPrompt(prompt, creator, session, round){
    // create chat and save result
    const chatCompletion = await openAIClient.chat.completions.create({
        model : "gpt-3.5-turbo",
        messages : [
            {
                role: "system",
                content : prompt
            }
        ]
    });

    // only the actual content is relevant atm
    result = chatCompletion.choices[0]['message']['content'];

    const data = {result: result, prompt: prompt, creator: creator};

    // save to db and if phase is still prompting phase

    if (await db.getRoundPhase(session)===0) {
        try {
            await db.savePromptResult(session, round, {prompt: prompt, playerNumber: creator, result: result});
        } catch (error) {
            console.error('Couldn\'t save prompt result to db!\n' + error);
        }
    } else {
        return false;
    }

    // return data
    return data;
}

module.exports = processPrompt;