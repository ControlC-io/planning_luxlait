import OtpChallengePage from './OtpChallengePage';

/**
 * Second factor step when 2FA is enabled (email OTP in this deployment).
 */
export default function TwoFactorChallenge() {
  return (
    <OtpChallengePage
      title="Authentification à deux facteurs"
      subtitle="Saisissez le code à 6 chiffres envoyé par email après votre mot de passe."
    />
  );
}
