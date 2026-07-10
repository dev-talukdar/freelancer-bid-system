export const realisticFreelancerActiveProjectResponse = {
  status: 'success',
  result: {
    total_count: 1,
    projects: [
      {
        id: 123,
        title: 'React dashboard development',
        preview_description: 'Build a React admin dashboard',
        type: 'fixed',
        status: 'active',
        frontend_project_status: 'open',
        deleted: false,
        local: false,
        language: 'en',
        seo_url: 'reactjs/React-dashboard-development',
        time_submitted: 1710000000,
        time_updated: 1710000100,
        jobs: [{ id: 69, name: 'React.js', seo_url: 'react-js' }],
        budget: { minimum: 250, maximum: 750 },
        bid_stats: { bid_count: 3, bid_avg: 420 },
      },
    ],
  },
};
