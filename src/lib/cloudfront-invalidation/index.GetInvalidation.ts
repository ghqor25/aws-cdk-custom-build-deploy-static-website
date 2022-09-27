import { CloudFrontClient, GetInvalidationCommand } from '@aws-sdk/client-cloudfront';

interface HandlerEvent {
   DISTRIBUTION_ID?: string;
   INVALIDATION_ID?: string;
}

interface HandlerResponse {
   STATUS: 'SUCCEEDED' | 'IN_PROGRESS';
}

const cloudfrontClient = new CloudFrontClient({});

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
   const distributionId = event['DISTRIBUTION_ID'];
   if (!distributionId) throw Error('"DISTRIBUTION_ID" is required ');
   const invalidationId = event['INVALIDATION_ID'];
   if (!invalidationId) throw Error('"INVALIDATION_ID" is required ');

   const result = await cloudfrontClient.send(new GetInvalidationCommand({ DistributionId: distributionId, Id: invalidationId }));

   // cannot achieve other status value, so just treat as 'IN_PROGRESS'.
   // @see https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_GetInvalidation.html#API_GetInvalidation_ResponseSyntax
   const status = result.Invalidation?.Status === 'Completed' ? 'SUCCEEDED' : 'IN_PROGRESS';

   return { STATUS: status };
};
export { handler };
