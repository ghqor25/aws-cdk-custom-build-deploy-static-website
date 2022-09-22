import { DefineAuthChallengeTriggerEvent, DefineAuthChallengeTriggerHandler } from 'aws-lambda';

const handler: DefineAuthChallengeTriggerHandler = async (event: DefineAuthChallengeTriggerEvent) => {
   console.log(event.request.session);
   if (event.request.session && event.request.session.length >= 3 && event.request.session.at(-1)!.challengeResult === false) {
      // The user provided a wrong answer 3 times; fail auth
      event.response.issueTokens = false;
      event.response.failAuthentication = true;
   } else if (event.request.session && event.request.session.length && event.request.session.at(-1)!.challengeResult === true) {
      // The user provided the right answer; succeed auth
      event.response.issueTokens = true;
      event.response.failAuthentication = false;
   } else {
      // The user did not provide a correct answer yet; present challenge
      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = 'CUSTOM_CHALLENGE';
   }

   return event;
};

export { handler };
