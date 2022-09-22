import { VerifyAuthChallengeResponseTriggerEvent, VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';

const handler: VerifyAuthChallengeResponseTriggerHandler = async (event: VerifyAuthChallengeResponseTriggerEvent) => {
   const expectedAnswer = event.request.privateChallengeParameters.secretLoginCode;
   if (event.request.challengeAnswer === expectedAnswer) {
      event.response.answerCorrect = true;
   } else {
      event.response.answerCorrect = false;
   }
   return event;
};

export { handler };
