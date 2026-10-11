import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout.jsx';
import { AuthForm } from '../components/auth/AuthForm.jsx';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const go = () => navigate(next, { replace: true });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to host rooms, run quizzes, and see your history."
      footer={
        <>
          New to Askly?{' '}
          <Link
            to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthForm
        mode="login"
        onSubmit={async ({ email, password }) => {
          await login(email, password);
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
