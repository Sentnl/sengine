import ky from 'ky';

const kyInstance = ky.create({
  timeout: 10000, // 10 second timeout
  retry: {
    limit: 5,
    methods: ['get', 'post'],
    statusCodes: [429, 503,500],
    afterStatusCodes: [429, 503,500],
    maxRetryAfter: 30000,
    backoffLimit: 3000,
    beforeRetry: async ({ error, retryCount, options }) => {
      console.log(`Retry attempt ${retryCount} due to ${error.response?.status || error.message}`);
      console.log(`URL: ${options.url}`);
      console.log(`Method: ${options.method}`);
    }
  },
  hooks: {
    beforeRetry: [
      async ({ request, options, error, retryCount }) => {
        console.log(`Retry attempt ${retryCount} for ${request.url}`);
        console.log(`Status: ${error.response?.status}`);
      }
    ]
  }
});
export default kyInstance;
