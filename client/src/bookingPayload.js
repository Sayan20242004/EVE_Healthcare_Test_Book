export function buildBookingPayload(centre, details) {
  if (!centre?._id) throw new Error('The selected centre has no saved database record. Search again and choose a centre.');
  if (!centre.tests?.some((test) => test.testId === details.testId)) throw new Error('Choose a test offered by this centre.');
  return {
    centreId: String(centre._id),
    testId: String(details.testId),
    appointmentDate: details.appointmentDate,
    appointmentTime: details.appointmentTime,
    persons: Number(details.persons)
  };
}
