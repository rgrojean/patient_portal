$(function () {
  $('#login-form').on('submit', function () {
    var u = $.trim($('#username').val());
    if (!u) {
      alert('Enter a username');
      return false;
    }
    return true;
  });
});
