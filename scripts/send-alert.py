"""发送站点异常告警邮件"""
import smtplib, os, sys
from email.mime.text import MIMEText

smtp_email = os.environ.get('SMTP_EMAIL', '')
smtp_pass = os.environ.get('SMTP_PASSWORD', '')
site_status = os.environ.get('SITE_STATUS', 'unknown')
api_status = os.environ.get('API_STATUS', 'unknown')

if not smtp_email or not smtp_pass:
    print('❌ 缺少 SMTP_EMAIL 或 SMTP_PASSWORD 环境变量')
    sys.exit(1)

def status_text(code, label):
    try:
        c = int(code)
        if 200 <= c < 400:
            return f'{label}：正常'
        return f'{label}：异常（状态码 {code}）'
    except (ValueError, TypeError):
        return f'{label}：无法检测'

body = f"""【实验室管理系统告警】

你的实验室管理系统可能出问题了，请检查一下：

【检测结果】
- {status_text(site_status, '网站是否能打开')}
- {status_text(api_status, '数据库是否正常')}

【你需要做什么】
1. 先打开网站看看能不能正常用：https://lab-management-3w7.pages.dev
2. 如果网站打不开，去 Cloudflare Pages 看看部署状态
3. 如果网站能打开但功能不正常，去 Supabase 看看数据库状态：https://supabase.com/dashboard
4. 查看详细日志：https://github.com/XiaoMai-cool/lab-management/actions

如果一切正常，可能是网络波动导致的误报，可以忽略。
"""

msg = MIMEText(body, 'plain', 'utf-8')
msg['Subject'] = '实验室管理系统异常告警'
msg['From'] = smtp_email
msg['To'] = smtp_email

with smtplib.SMTP_SSL('smtp.163.com', 465) as server:
    server.login(smtp_email, smtp_pass)
    server.sendmail(smtp_email, [smtp_email], msg.as_string())
print('✅ 告警邮件已发送')
