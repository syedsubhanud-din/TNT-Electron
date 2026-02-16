export const formatDatabaseError = (error: any) => {
  return {
    success: false,
    message: error.message || 'An unknown database error occurred',
    code: error.name || 'DB_ERROR',
  };
};

export const parseHStore = (hstoreString: string) => {
  // Simple utility if they need to manually parse hstore strings
  // Although Sequelize/pg handles this automatically
  return hstoreString; 
};
