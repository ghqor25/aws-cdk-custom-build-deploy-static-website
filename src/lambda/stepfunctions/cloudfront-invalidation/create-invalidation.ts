import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfrontClient = new CloudFrontClient({});

const handler = async (event: any) => {
   const distributionId = event['DISTRIBUTION_ID'];
   if (!distributionId) throw Error('"DISTRIBUTION_ID" is required ');

   try {
      const result = await cloudfrontClient.send(
         new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: { Paths: { Quantity: 1, Items: ['/*'] }, CallerReference: Date.now().toString() },
         }),
      );

      return {
         INVALIDATION_ID: result.Invalidation?.Id,
         DISTRIBUTION_ID: distributionId,
      };
   } catch (e) {
      throw Error('createinvalidation error' + e);
   }
};
export { handler };
