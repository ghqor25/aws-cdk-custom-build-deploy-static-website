import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import axios from 'axios';

export interface ApiIdsGetByNameProps {
   test: string;
}

const test = () => axios.get('https://m.popcone.co.kr/goods/goods_search.php?keyword=%EA%B0%A4%EB%9F%AC%EB%A6%AC');
//
const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
   const a = await test();
   const t = event.stageVariables;
   console.log(t);
   return {
      body: 'g',
   };
};
export { handler };
