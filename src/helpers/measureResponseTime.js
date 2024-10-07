import { performance } from 'perf_hooks';

export const measureResponseTime = async (apiCall) => {
  const startTime = performance.now();
  try {
    const result = await apiCall();
    const endTime = performance.now();
    return { result, responseTime: Math.floor(endTime - startTime) };
  } catch (error) {
    const endTime = performance.now();
    error.responseTime = Math.floor(endTime - startTime);
    throw error;
  }
};