import ky from 'ky';

const kyInstance = ky.create({
  retry: {
    limit: 10,
    methods: ['get', 'post'],
    statusCodes: [429, 503],
    afterStatusCodes: [429, 503],
    maxRetryAfter: 30000,
    backoffLimit: 3000
  }
});

export default kyInstance;
