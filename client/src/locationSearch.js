const LOCATION_ERRORS = {
  1: 'Location permission was denied. Allow location access in your browser, or enter a city manually.',
  2: 'Your location is unavailable right now. Please try again or enter a city manually.',
  3: 'Finding your location took too long. Please try again or enter a city manually.'
};

export function getCurrentCoordinates(geolocation) {
  if (!geolocation?.getCurrentPosition) {
    return Promise.reject(new Error('This browser does not support location. Please enter a city manually.'));
  }
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(LOCATION_ERRORS[error?.code] || 'We could not find your location. Please enter a city manually.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export function buildCentreSearchParams(query, coordinates) {
  if (coordinates) return { lat: coordinates.latitude, lng: coordinates.longitude };
  return { q: query.trim() };
}
