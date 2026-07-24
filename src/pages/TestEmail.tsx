import { useState } from 'react';
import { Mail, Send, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Status = 'idle' | 'sending' | 'success' | 'error';

export function TestEmail() {
  const { appUser } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('send-transaction-email', {
        body: {
          to: email.trim(),
          triggered_by: appUser?.email || null,
          source: 'test-email',
          transaction: {
            entity: 'Test Entity',
            transaction_type: 'BUY',
            share: 'Test Share Ltd',
            ticker: 'TST',
            transaction_date: new Date().toLocaleDateString('en-GB'),
            cds_acc_type: 'Primary',
            cds_acc_no: 'CDS-0000000',
            order_type: 'Market',
            no_of_shares: '1,000',
            gross_price_per_share: '100.00',
            net_price_per_share: '98.87',
            total_amount: '100,000.00',
            broker_name: 'Test Broker',
            brokerage_fee_type: 'Standard',
            brokerage_fee_rate: '1.12%',
            brokerage_fee: '1,130.00',
            bank_name: 'Test Bank',
            bank_acc_no: '0000000000',
            note: 'This is a test email sent from the Portfolio Management System to verify email delivery.',
          },
        },
      });

      if (error) throw error;

      if (data?.sent) {
        setStatus('success');
        setMessage(`Test email sent successfully to ${email.trim()}`);
      } else {
        setStatus('error');
        setMessage('Email function responded but the email was not sent. Check that the BREVO_API_KEY secret is set correctly in Supabase.');
      }
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }

  function reset() {
    setStatus('idle');
    setMessage('');
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-1">
          <Mail className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Test Email</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">Send a test email to verify the email delivery configuration is working correctly.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Email Configuration Test</h2>
        </div>

        <div className="p-6">
          {status === 'idle' || status === 'sending' ? (
            <form onSubmit={handleSend} className="space-y-5">
              <div>
                <label htmlFor="test-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  id="test-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={status === 'sending'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">What will be sent</p>
                <p className="text-blue-600">A sample transaction email simulating a BUY order for <span className="font-mono">TST</span>, using the same template as live transaction emails.</p>
              </div>

              <button
                type="submit"
                disabled={status === 'sending' || !email.trim()}
                className="flex items-center space-x-2 px-5 py-2.5 bg-[#3e5a7d] text-white text-sm font-medium rounded-lg hover:bg-[#2d4560] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </form>
          ) : status === 'success' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Sent</h3>
              <p className="text-sm text-gray-500 mb-6">{message}</p>
              <button
                onClick={reset}
                className="px-5 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Send Another
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delivery Failed</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{message}</p>
              <button
                onClick={reset}
                className="px-5 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
