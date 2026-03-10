import apiClient from './client';

export const servicesApi = {
  pipelineStages: () => apiClient.get('/pipeline-stages'),
  list:           () => apiClient.get('/services'),
  industries:     () => apiClient.get('/industries'),
  bundles:        () => apiClient.get('/bundles'),
};
