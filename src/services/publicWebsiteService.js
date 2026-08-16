const prisma = require('../config/prisma');

const getPublicWebsiteSettings = async () => {
  const settings = await prisma.websiteSetting.findFirst();

  if (!settings) {
    return { settings: null };
  }

  // Ne retourner que les champs réellement destinés au public
  return {
    settings: {
      companyName: settings.companyName,
      logoUrl: settings.logoUrl,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      whatsapp: settings.whatsapp,
      facebook: settings.facebook,
      twitter: settings.twitter,
      instagram: settings.instagram,
      generalInfo: settings.generalInfo,
    },
  };
};

module.exports = {
  getPublicWebsiteSettings,
};