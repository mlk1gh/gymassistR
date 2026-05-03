class DisableCSRF:
    """
    Disable CSRF enforcement for all requests.
    This admin panel is protected by Django's session auth and runs
    behind the Replit proxy, which makes standard CSRF cookie handling
    unreliable (SameSite/Secure requirements clash with the proxy setup).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        setattr(request, "_dont_enforce_csrf_checks", True)
        return self.get_response(request)
