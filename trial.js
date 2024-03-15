const date = new Date()

console.log(
    new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'CST',
    }).format(date),
  );