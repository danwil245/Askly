import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout.jsx';
import { AuthForm } from '../components/auth/AuthForm.jsx';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function Signup() {
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const go = () => navigate(next, { replace: true });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and takes a few seconds. No credit card."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-primary hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <AuthForm
        mode="signup"
        onSubmit={async ({ name, email, password }) => {
          await signup(name, email, password);
          go();
        }}
      />
      <div className="mt-4">
        <GoogleSignInButton
          onCredential={async (idToken) => {
            try {
              await googleLogin(idToken);
              go();
            } catch (err) {
              toast(err.message || 'Google sign-in failed', { variant: 'error' });
            }
          }}
          onError={(m) => toast(m, { variant: 'error' })}
        />
      </div>
    </AuthLayout>
  );
}
