/** Server-safe SVG filter for liquid-glass backdrop refraction. */
export function LiquidGlassFilter({
  id = "liquid-lens",
  scale = -48,
  chromaticAberration = true,
}: {
  id?: string;
  scale?: number;
  chromaticAberration?: boolean;
}) {
  // Embedded so feImage never fails to load under backdrop-filter.
  const mapSrc =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABEwAAABACAYAAAAAjOLSAAAnTUlEQVR42u3d57dW9bn18X2MHRsI0gRp0nvvvffepIgooqioqBjJkz1zghEVFQURKdKl99577x2kSRVBsdfEzOe73TcRjTnn/AHXuMdnxOx9r9815355jbUWSXnzyvnyyAVyywVzyoVzyEWzy8WyySWyyqWyyGUzyeUzyhUzyJXTy9XSyTXSyrVvl+vdJje8RW6SRm5+s9zqRrndDXLH6+XO18ndrpUf+oPcE49dIz/5X/IzeB5/QjIUQgghhBBCCCGEkPBXvIRX8QYGXyO/8wd5ON67Vh57nTzxennyDfK0G+VZN8tz08gLbpEX3SovvV1ecYe8Kp289k55fQZ5013ylkzytszyjqzyrrvlPdnlvffI+3PKB3PJh/LIR+6VP8grJ+XJJ/+npUnxbHJJDimdObE04fBKDKnCsOoMrcXwuoSoT5jGhGpGwJY3yW0I24HQnShwP0UevPaqhQmewfP4E5KhEEIIIYQQQgghhIS/4iW8ijcw+A+pC5MR18qjMe46+f3r5Sk3yjNukmffLM9LIy+8VV5ym7z8DnllWnnNnfK69PLGu+TNGeWtmeXtWeSdd8u7s/2yLDnwm2XJ0fxyUu4C8m+XJoVSlib3JJYmd6cuTcpwaDkOr3BX6l0mVf/DXSYtCNqawO1vkO8jfFd0p8jD6IXe6IO+6IdkKIQQQgghhBBCCCGhPwbgVbyBwdfL72AERmP8DfIkTL1RnnmTPCeNPP83d5esTpe6LNmQcndJyrIk0+8sS3IkliW5f70sOV5ATspZUP5PS5MiXFwsu1zi7tRHc1KWJlcezblyl0lNQtQhTIOUu0zSpN5l0grtCHwfuqI7HqZEL/RGH/RFPyRDIYQQQgghhBBCCAn9MQADMegmeQiGYQRGY/zN8iRMw6w0/353yaq0v/MoTpbUR3GuLEv2/c6y5FhiWXKikJyUo7D8u0uTXFctTbL9sjS5+tGcqnf++i6TRoRrhlZod4t8H7qiOx4mfC/0Rh/0RT8kQyGEEEIIIYQQQggJ/TEAAzHoFnkIhmEkxtwqT8AkTLtNnoV5WHR76t0lKY/iXLm75MqjOP96b0m21PeWXL0sOXz1sqRg6rLkwyJyUvai8s9Lk0L/+9LkyvtMymX65dGclBfA1iJMPTRC0zvklmiLjgTtiu54GL0o0Bt90Bf9kAyFEEIIIYQQQgghJPTHAAzEoNvlIRiGkRhzhzwBkzE9rTwL89LJi7AMq+5Mvbsk5VGcq99bcuUlrz8vS3JetSzJ98uy5GRiWXKqqJyUrZicsjS5J7E0yfV7S5PfvAT2yvtMKt0lVyVATdRNLzdEU0K1RFt0JGgXPIAe6EWJ3uiDvuiHZCiEEEIIIYQQQgghoT8GYCAGpZOHYBhGYsyd8gRMTi9Px2zMzyAvwrK75FVYl1HemDH1UZwr7y35Py9LislnistJWUvI2YonliZF/n1pkj+PXDDXVf9yzpVHc1Axs1wVNQlQFw0J0xQtCdcWHQnbBQ+gBx6lRG/0QV/0QzIUQgghhBBCCCGEkNAfAzAQgzLIQzAMI++Sx2ICJmeUp2N2Jnk+FmN5ZnkV1mWRN2FrVnnnVe8t+Y/LksKpy5LTiWXJ2ZJyUpZSclb+4+6UpUmx3yxN8v/+0qQkg8qi4t1yFdRgeB00IEwTtCBcG3RAZwI/gB54lCJPoA/6oh+SoRBCCCGEEEIIIYSE/hiAgRiUSX4b72JUZnksJmJKFnkG5mSV52Px3fJyrM4mr8em7PI27Lznl38++OBvliUnEsuSlEdwfl6WlEhdlpwvLSdlKitnLp1YmqTcbZJYmuRIWZoU/PelSVEGlESZHHIFVGFoDdQhRAM0IVQLtCFkB3QmdDf0wKMUeQJ90Bf9kAyFEEIIIYQQQgghJPTHAAzEm1nlt/EuRt0tj8XEbPIUzMCc7PICLLlHXpFDXo31OeXN2JZL3oW9uX+zLCnwm2VJyl0lJeRzpeTzZeSPyspJGcvLPy9N+EHK3SZXliZXXgZ79dKkIIpweIk8chmUZ1hlVGd4bdQnTGOCNUdrgrZHZ0J3w0N4lCJP4Gn0RT8kQyGEEEIIIYQQQggJ/TEAr+HN7PLbeBej7pHH4f0c8lTMzCnPxYJc8hKsyC2vwfo88uZ75e3YlVfeh4P5rlqWpLyvJLEsufIIzpVlyYVy8sfl5aQMFeW7+I+M5X5ZmqTcbXLlvSZXliZ5UYBDi6B4frk0Q8qjMkOroxYh6hGoEZoTrjXaE7YT7if8Q3iEMk/gafRFPyRDIYQQQgghhBBCCAn9MQCv4c2c8tsYjvdyyePwfm55Kmbmkedi4b3y0rzySqzJJ2/Alvzy9gLybuwrKB/CB4V++WeDT/3mEZyUu0p+XpZUkC9WlJPSV5YzVJLv4gf/utuk9FXvNSkq58S9HFYAhQvLxVGKAeUYVgnVGF6LIPXQiFDNCNgK7QjcCfcT/kE8QpnH8TSeQz8kQyGEEEIIIYQQQggJ/TEAr+HNPPJQDMd798rjMCmvPC2fPAvz8suLsLSAvLKgvBYbC8lbsKOwvLuIvB+HispHcaLYL+8rufoRnJS7SlIWJZcqyZ9UkZPSVZPv5D9+Xpwk7jbJdNXdJtlKyjmRh4PyF5cLoxgHl2JIOVRkaFUC1ERdwjQkWFO0JGg7At+HrhR4ED0p9DiexnPoh2QohBBCCCGEEEIIIaE/XsZreCufPBTD88ujMb6APAnTCsqzMK+QvKiwvAyrishri8obsbWYvKO4vAf7S8iHcbSkfBKnS8nnUu4qKXPVXSWV5EuV5U+qyp9Wk5PS1pDTVUfV1MXJv+424YIsZeVsyMEBeZCPwwpxaFGUZEBZhlVEFYbXIEgdNCBUEwK2JGhbdCR4Vwp0R08KPY6n8Bz6IRkKIYQQQgghhBBCSOiPl/Ea3iooD8WIQvJojC8sT8b0IvLsovJ8LC4mLy8uryohr8OmkvLWUvJO7CktH8DhMvKxsvJJnCknn8eFK3eVVE69qyRlUXK5uvxZTTnp9tryHbXkK4uTO6um3m1yVyU5MxfdjRwV5Nwckg8FObAoSjCgDMMqMLQKahCiDoEaEKwJIVugDYE7ErwLulOkJ4Uew1N4Dv0omsz/KoQQQgghhBBCCCGhP17G63iriPwORhSVx2BCMXlycXk65pSQ55eUF5eSl2N1aXl9GXlTWXkbdpaT9+JAeflIBfkYPqwon8H5Som7Sqok7iqpLl+uKX9WS/68jpx0Wz359rpIWZzUTCxOqskZ+HJm3M2F9yB3ZTkvCnJYEQ4ugdIMKs/QygyvTpDaqE+wxgRsTtDWhO5A+C54gCIP4zGKPYXnKNkPyVAIIYQQQgghhBBCQv9i8st4HYOLy+9gZAl5DCaWlKeUkmeUlueUkRdgSVl5RTl5TXl5PTZXkLdXlHdVkvfhYGX5CI5XkT/EmaryR7hYLXFXSY3EoqS2/EVd1JOTbmko31pf/nlxUid1cZKWL2WoKWdCVi66B7mqy3lRgIMKc2hxBpRGOQZWYng1gtQiUD2CNSJkM7QmcHuCd6ZEN8r0QC+KPYlnKfkCkqEQQgghhBBCCCGEhBfxSkn5dQwuJQ/DqNLy2DLyREwtK88sJ88tLy+sIC+tKK+sJK/Bhsryliry9qrybuyrJh+qLn+A4zXkUzhbU/4IF2vJl3+zKPmygfxVQzkpTRP5lsZIWZw0SF2cpEV6vpgJWevI2ZGLi+/lkPwozKHFGFAKZRlYkeFVCVGTQHUJ1pCATQnbitDtCN+JEt0o0wO9KPYknqXoC0iGQgghhBBCCCGEEBJexCtl5DcwpKz8LkaVk8eVl9+vIE+rKM+qJM+rLC/Csiryyqry2mryxurylhryDuyuKe+vJR/C0dryiTryKZytK1/ApXry5Xq/XpR81Vj+uomcdHNz+eZmcsriJA0/vLWRnBbp+VJGZOGC7MhZX87DAflRiEOLMaAkyjKwAoOrEKIGYeoQrAEBmxC0JYHbEvw+StxPmYco9SjlelPyWbyAZCiEEEIIIYQQQggh4UW8gjfKy0MqyO/ivYry+ErypMrytCry7Kry/Gry4ury8hryqpryulryptry1jryTuypK++vJx/G0fryCZxuIJ9rKF/AJVxuJH+Jr1MWJU3lb5qhuZx0Yyv5ppZokbo4uRV38IU7kRFZmsjZkIML83BAPhTkwKIMKIEyDCvP4MqEqE6Y2gSrT8DGhG1O6DaE70iJrpR5kFKPUK43JZ/BC0iGQgghhBBCCCGEEBJexCsYVEl+u7I8vIo8uqo8oZo8ubo8vYY8p6a8oJa8pLa8vI68uq68vp68qb68rYG8E3sbygcayYdxrLF8EqebyOdwoan8CT5rJn+ZWJJ82wIt5e9ayUk3tJNvbIPW8s384FbcwS/vxF3IzJezIQcX5kZeDinIgUU4vDhKM6wcgysRohphahGsHgEbEbYZoVsTvgMlulCoO8V6UvAJij6DF5AMhRBCCCGEEEIIISS8iFcxqKo8tJo8oro8poY8saY8pZY8o7Y8t668sJ68tL68ooG8pqG8oZG8ubG8vYm8C3ubygebyUdwrLl8EmdayOfxcUv5E3zWSv4S3+C71mgrf99OTrq+o3xDB7SXb+IHt+AOfnkn7kLmNvLduIeLciMvBxTgwMIozoBSDCvH4IqEqEqYGgSrQ8AGhG1K6JaEb1dH7kSZByj1MAUfp2gf/JHSyVAIIYQQQgghhBBCwt+qy6/izRryOzXlkbXksbXl9+vKU+vJs+rL8xrKixrJyxrLK5vIa5vKG5rJW5rL21vIu7GvpXywlXwEx1vLH7aRz+A8Pm4rf4LP28lf4Vt8317+oQM6yknXdZav6yRff598E27B7fwiHTIgM1+8G/dwUS7cywH5UZhDizGgJAPLogLDqxCkOsFqE7A+QRsTugXh2zaQ76PM/RTrUUd+jKJP44+UToZCCCGEEEIIIYQQEv6GgbXkt2rLw+rIo+rJ4+rLkxrI0xvJsxvL85vKi5vJy5vLq1rI61rKG1vJW1vLO9rIu9vK+3GonfxBe/k4Puwgn8H5jvJFfIrP75O/wrf4oZP8Y2d0kZOu7SZfe798fVf5JtyC25GOX2ZAJr6YFdmRiwvvRX4OKcShRVGCQWUYWp4AlQlSjVC1CFePoI0I3IzwrZvIHSjTpaH8IAV7UfTpuvIfKZ0MhRBCCCGEEEIIIST8Da/VlQfXk99tII9uKE9oLE9uIs9oJs9pIS9oKS9pJa9oI69uK69vJ29qL2/tIO/Eno7y/vvkQ/igk3wCpzrLZ/FRF/kiPsXnXeWv8C1+wN/vRzc56Q8Pydc+KF/XXb4Jt+B2pHtAzoBMyMoXsyMnF+VBPg4oiKIcXAKlGVaOwZUIUZVANQlWh6ANCNyktdySEu2ay52ayt0p+AhFn6Tw8/XlZCiEEEIIIYQQQggh4SW83kAe0lAe3lge01Se2Fye2lKe1Uqe10Ze1E5e2l5e2UFe01HecJ+8uZO8rbO8s4u8Fwe6yofvl4/iRDf5FM7iowfki/gUn3eXv8K3+BF/f1D+x0MpC5OecorrHpZvRBrcjnQ95AzIhKzIzpdzIg8X5kNBDimC4hxeimFlUZEAVQhTnVC1CVmfsI0J3pwSbSjTkWL3U/BhivamcN9G8p8prxBCCCGEEEIIIQT8BQMayW80loc2lUc2l8e1lCe1lqe3lWe3l+d3lBd3kpd3lld1kdd2lTfeL2/pJm9/QN6Fvd3lAw/Kh3H0IfkETuFsD/kjXMSnD8tf4Gt8hx/xj56pkq55TE5xXS/5RqTBbUiL9I/KGZEF2ZDjETk38nJhARRGcQ4rxZCyqMDgygSpRqhahKtL2IYEb0qJlpRp107u0kZ+iKKPN5OfayL/GQohhBBCCCGEEELAXzCgqfxmM3lYS3l0a3lCO3lKB3lmJ3luF3lhV3lJN3nFA/Lq7vK6B+WND8lbesjbH5Z3Y19P+SCOPCIfw0mcflQ+hwu4hMu95C/wNb7Dj/jpsVRJ//WkfA2u6y3fiDS4DWmRHhmfkLMgG3Ig9+NyXhRAYQ4ohpIcWAblGVaJAFUJVINwdQhan9CNCd/8frkNpTp2lLu1lR9tJT/bXP4zFEIIIYQQQgghhIC/4JUW8uBW8oi28tgO8qRO8vSu8uxu8vzu8qKH5GU95JU95TWPyOux6VF5ay95B3Y/Ju/DwcflIziGk0/Ip3EOF3Cpt3wZX+BrfIcf8dOT8j+fTFmYPCNfg+v6yDciDW5DWqRHRmRBtqflHMiNvCjwlFwYxVCSg8qgHAdXRBUGVydMLcLVI2hDgjd9WG5JobaU69xZ7tFefrq1/OeW/EFCCCGEEEIIIYQQ8BcMbC0PbSe/d5888X55and5Zg95bk95waPy4l7y8sfkVY/La5+QN/SWN2Prk/IO7H5K3oeDOPK0fAwncRrn+sgXcAmX8QW+xnf4ET89I//zmZSFyfPyNbiur3wj0uA2pEV6ZEQWZEMO5H5OzosCKIyiKPGsXBrlUJFDq6A6Q2oRpC4aELYxwZtRpBXF2lPyfgo/3l7+f234g4QQQgghhBBCCCHgv/FGe3l4Z3l8d3lyT3lGL3n2E/K83vKip+QlT8vL+8irsPYZeQM2Pytvw07seU7eh4M4gmM42Vc+jXO4gEu4jC/wNb7Dj/jpefmfz6csTCRfg+twI9LgNqRFemREFmRDDuRGXuRHIRRFCZRGOVREZVRDTdRBPTREEzRDS7RGW7SDQgghhBBCCCGEEDAJkzEF0zADszEXC7AYS7ECq7EOG7AZ27ATe7Afh3AEx3ASp3EOF3AJl/EFvsZ3+BE/gSBO+q+X5Gtw3QD5RqTBbUiL9MiILMiGHMiNvC/LBVAYxVDyFbkMyqEiqrwqV0etgXLd1+QGr8uN35CbvSm3Giy3Gyp3Hi73HCf/aRJ/kBBCCCGEEEIIIQT8FYPHyaNGyeOHyZPflqe/Jc8eJM97Q174urzkNXn5QHnVq/JabHhF3oyt2PGyvBv7cBBHcGyAfBKncQ4XcAmX8QW+xnf4ET+9JP/zpZSFCQdfg+twI8PS4DakRXpkRBZkI0wO5EZeFEBhQhZDSZQhdHlUokBV1HhTrk2heoPlhkPkpkPllhRtO0K+7z25+3i592T5/03lDxJCCCGEEEIIIYSA/8brk+Rh4+XRo+WJI+Wpw+WZ78hzhsoLhsiLB8vL3pJXvimvGSSvx6Y35K3Y8bq8G/tw8DX5CI7hJE7j3ED5Ai7hMr7A1/gOP74q/4R/vpqyMOGwa3AdbmLALbgd6ZABmZCVANmRE3mQj1AFUQTFCVkKZQlcAZXflqtRoCZF6gyTG7wrN6ZYcwq2pmiHsfL9E+Wek+U+0+U/z+APEkIIIYQQQgghhIC/4NVp8tuT5ZET5XHj5Elj5Gmj5Fkj5XnD5UXvykvfkVcMlVdj3dvyxiHyFmwfLO/C3rfkAziMo2/KJ3AKZ/HRIPkiPsXn+Arf4sc35J/wTyRdwyF/wPW4iYNvwe1IhwzIxNCsyI6cyEOQfCiIIoQrjlLD5LKErYAqBK8+Qq5FiXqUaThabkqxlhRsN0HuNEnuPlXuxR/g2Vnyn6EQQgghhBBCCCEE/AWvzJTfmi4PnyqPmSRPnChPGS/PHCvPHS0veE9eMkpePlJeNUJeO1ze+K68ZZi8HbvekffiwFD5MI7ixNvyKZzFR7g4RP4Un+MrfIsfBsv/wE9I+gMHpLgeN3HoLbgd6ZABmRiYFdmRkwB5kB+FCFQUJQhXmpDlUJHAVQleY4xcmxL1x8mNJ8jNKdaagh2myF0p3IPiT8yWn5sr/xkKIYQQQgghhBBCwF8wYI48aLb8zkx51DR5/BR58mR5+vvy7Any/PHyonHysjHyytHyWmx4T948St42Ut6JPSPk/Tg0XD6KEzj1rnwWH+HiMPlTfI6v8C1+eEf+R4qhKQsTLriWA67HTbiFQ29HOtyFzAy7G/cgF8PvRX6CFEJRgpVAmbFyeYJWInA1gtecKNelRINJchMKtZwqt50ud6JoNwr3pHzveXLf+fKfF/AHCSGEEEIIIYQQQsBf8NJ8+Y158tA58shZ8tiZ8vvT5alT5ZlT5LmT5IXvy0snyismyGvGy+vHyZvGyluxc4y8B/tHy4fwwXvycXw4Sj6D8/h4pPwpPsdX+HaE/AP+jn8Ml5Ou5YJrufh63IRbOfAO3Im7GJIZd+MeBufCvShAkMIoRqiShCuDCgStTODqk+VahK9HiUaUaTZDbkW59rPlLnPl7pR+lPJPLZKfRzIUQgghhBBCCCGEkPASXl8oD1kgD58nj54rT5gtT5kpz5ghz5kuL5gmL5kiL58sr54kr8PG9+WtE+UdE+Td2DdePogPxsnH8eFY+QzO4+Mx8if4DF/i29HyD/h7ivfkpOv40nVcdAMH3IxbOfAO3Im7kJlB2ZCDobmRlwAFUJhAxVGKcGWnyhUJWgU1CF2b8PVnyY0p02KO3IZyHefLXSn7EKV7LZafXiL/camcDIUQQgghhBBCCCEk/A2vLZEHL5bfXSS/t0AeP1+eNFeePkeePVueP0tePFNeNkNeNV1eO03eOFXeMkXejl2T5X2T5IM48r58DCcnymdwHh9PkD/BZ/hyvPwNvseP4zBWTrqeL13PRTdwwM24FXdwaHpkRBaGZEMOhuZGPgIURBHCFEdpgpUjYCWCViVwTYLXpUDDeXJTyrSkVDvKdaJkN8r2WCY/tlzugz+ukJOhEEIIIYQQQgghhIS/YeBy+a1l8jtL5VFL5HGL5PcXytMWyLPmy/PmyYvmykvnyCtny2tmyRtmyptnyNuxa7q8d5p8AEemysdwcop8GudwYbL8CT7Dl5Pkb/A9fngfE+WkG/jFjXzxRi68mUNuQ1oOTY+MyMKQbMjJ0DzIR4CCKEqYEoQqg/IErEzQagSuRfB6FGhEkWaL5VaUak+5zhR9gMI9V8qPr5L74I+r5WQohBBCCCGEEEIIIeFvq+RX8eZKeegKeeRyecwyeeJSecoSeeZiee4ieeFCeckCecV8ec08ef1cedMceRt2zpb3zJIP4PBM+ShOzJBP4xwuTJcv4fI0+Qt8g++mYor8/WQ56UZ+cBNfvIkL03DIbUiL9BycCVkZkh05GZoH+QlQCEUJUxJlCFaBgJUJWp3AtQlenwKNKdKcQm0o1oGCXSjandKPrJGfWCs/gxeQDIUQQgghhBBCCCEkvIhXMWiNPHS1PGKVPHqlPGGFPHm5PGOZPGepvGCJvHixvByrF8nrFsqbFshbsXO+vGeevB+H5spHcWKOfApnZ8sXcAmXZ8lf4Gt8OxPT5e+myUk384Ob+UIaLkjDIbchHTJwcCZkRXYG5cK9DM5PgMIoRphSKEu4ioSsQtgahK6DBhRoQpEWFGpLsY4U7ErRB9fJj6yXe2+Qn8ELSIZCCCGEEEIIIYQQEl7EKxi0Xn57nTx8rTwa49fIk1bL01fJs1fK81fIi5fLy5bJq5bKa7FxibxlsbwDuxfJ+3FoofzBAvk4TuHsfPkjXJwnX8YX+Hou5sjfzE5dnCSlmZu6KLmFL97KAbdzUDpkQCYOvxv3MCwX8jK4AAoTpDiBSqEc4SoRsipqErguwRtSoClFWlKqHeXuo+T9G+WH8Ogmufdm+Vm8gGQohBBCCCGEEEIIIeFFvII3NslDNsrv4r0N8rj18qR18rS18qw18jwsWi0vXSWvXCmvXSFvwJbl8vZl8m7sWyofxAdL5OP4cLF8Fh8tki/iU3y+UP4SX82Xv56XujhJumVB6qLkVr5wGxfeziHpOPAuZGbA3cjBsNzIy/CCKEKQEihNqPKEq4RqhK1F6HqEb0SJZmhFofaU60TJblvkHui1VX4Sz26TX0AyFEIIIYQQQgghhJDwIl7ZKr+BIVvkYRi1WR67SX5/ozwVMzfIc9fLC9fJS9fKK7BmjbxhtbwZ21fJu7B3pXxwhXwEx5fLH+IMzi+TL+LTpfLn+GKJ/OWiXxYnSVcvSu7ggrQcdCcH3oXMyMaQHMjN0HwoSICiKEGgMgQrj8qErE7Y2gSvj8aUaE6Z1hTrgM4UfWC7/DB67ZCfxLM75ReQDIUQQgghhBBCCCEkvIiXd8ivY/B2eRhGbpPHbpUnYsoWecZmec4meQGWbJRXbJBXY/16efM6eRt2rpX34sAa+QiOrZZP4swq+Tw+Xil/gs9WYPmvFydJVxYld/DLtHw5HRfeyWEZOTgLsjEoJ/IgH4MLEaIoShKoLCoQsApBa6AOoRtQoAlFWqANxTpQsgse2CU/vFt+DE/huT1yPyRDIYQQQgghhBBCCAn9d8sv43UM3iW/g5E75TGYsEOesl2egTnb5AVb5cVb5OVYvVleh02b5K0b5Z3Ys0E+gMPr5WM4uU4+jfP4eK38CT5dLV9OLE4+X5a6OEn6eVGy8pdFSXouyMBBGTk0CwOyIyfD7kV+hhdCMcKUQlmCVSRgVdQgcB2CN0ATirSgVFt0pGiXvXJ39NwnP4an8Bz67ZeT+V+FEEIIIYQQQgghJPTHy3gdb+2V38GIPfIYTNgtT94lT8fsnfJ8LN4hL9sur8K6bfLGrfJW7Ngi78H+zfJhHN0kn8BpnNsoX8DF9fKldfIna369OElKt0q+c01iUcKX7uLLGTkkEwdm5fDsDMqFexlaAIUJURylCFQOlQhYlbA1UZfgDSnRFC0p1Xa/fB+6HpAfRM+D8uN4Cs+hH5KhEEIIIYQQQgghhIT+eBmv4a0D8lCM2C+Pxvh98iRM2yvP2iPPw6Ld8jKs2iWv3SlvxJYd8g7s3i7vx6Ft8lGcwKmt8jl8tEW+sEm+uEG+tD5xt0nK4mSVnHT1XSV3bUpdlmTmoiwclpUB9yAXA/OiAMOLoDhhSqMc4SoRshpqEboeGlGiGYVaod0h+T7cf1h+EI8ckR/H03gO/ZAMhRBCCCGEEEIIIST0x8t4DW8dlodi+CF5NMYflCdh2gF5Fubtlxdh6T555V55LTbskbdg+255N/btkg/hg53yCZzC2R3yuW2Jpclm+eONicXJutTFSdK/7irZlHpXSeZtqcuSu7k4G4few6DcyMvggihCiBIoTajyqEzI6gSuhXoUaIRmFGqF9h/InXD/UfkhPHJMfhxP4zn0QzIUQgghhBBCCCGEkNAfA/Aa3jwqD8VwvPeBPA7vH5GnYuZhee4heSGWHpRXYM0BeQM275e3Y9c+eR8O7pU/wHGc2iOf3iWf3Smf2y6fT7nbJGVpctXdJklX7irJlHJXyTY56w75bi7Kvid1WZKTw3MzMB8KEqAoShCoDCoQrjKqE7Y2weujMWWao/VxuT06nZC74SE8clJ+Ak+jL/ohGQohhBBCCCGEEEJI6I8BeA1vnpDfxnC8d1weh/ePyVMx86g8Fws+kJdgxRF5DdYfljdj2yF5F/YelA/iyAH5OE7ukz/cK5/eLZ+5sjT5zd0mST/fVXLlEZwdcrbEsiQHF+c8kLosuZch+RhcCEUJUhJlCVYBVQhaA3UIXh+NKdMcbT6UO6DzKbkbHsKjp+Un8DT6oh+SoRBCCCGEEEIIIYSE/hiA1/DmKfltvItRH8pjMfGkPAUzTshzsOC4vATLsfqYvB6bjsrbsPMDeS8OHJGP4Ogh+fhB+eT+q5Ymu656RGdr6tIk6beP4PxqWXLol2VJAYYVIkQxlCRUWVQkZBXUIHQdNKBIE7Q4I7dBB3Q+K3dDDzx6Tn4CfdAX/ZAMhRBCCCGEEEIIIST0xwAMxJtn5bfxLkadkcdiIqaclmdgzil5ARZ/KC/H6pPyOmw6IW/DTuw9Lh/AoaO/XpqcSCxNUh7R+dfSJPGITtLPj+Bc9b6S/2lZUoTBxQhTCuUIVxFVUZPQddGQIk3Q4rzcBh3R5SP5AfTAoxfkJ9AHfdEPyVAIIYQQQgghhBBCQn8MwEAM+kh+G+9i1Hl5LCZiyjl5BmafledjMZafkVdh3Wl5E7aekndiD/adlA9evTQ5/O9Lk5T3mlx5RCcp5X0lVy9Lcv1mWZL/mFzwhFw4ZVnCgBIMLk2gcoSrhKoErom6lGiIpmj5sdwWHS/KXfAAeuDRS3Jv9EFf9EMyFEIIIYQQQgghhJDQHwMwEIMuykMwDCM/lsdgAiZfkKdjNuZ/JC/CsvPyKqzDxnPyVuw4K+86Le/9UN6fWJoc/p2lScp7TX5emiTea5J05eWuOfb/D8sSDiyaWJaUYlgZQpQnUCXCVkMt1KNEQzT9RG6Jtuj4qdwFD+Bh9Los90Yf9EU/JEMhhBBCCCGEEEIICf0xAAMx6FN5CIZhJMZ8Ik/AZEy/JM/GvIvyIizDyo/ltdh4Qd7ykbztnLzzrLz7ytLkxL8vTY6lLE0O/HppknTlX8L53WXJ8V+WJcXPyCUZUOa8XI6hFQlRhVDVCFuLAvXQCM0+k1uh3efyfeiK7nj4C7kXeqMP+qIfkqEQQgghhBBCCCGEhP4YgIEY9Lk8BMMwEmM+kydgMqZdlmdhHhZ9Ki/Fyk/ktVh/Ud6UWJpsT1manPm/L01SHtFJ+tWyhC/l/b1lyenUZUnp83JZBlX4WK58Sa5KgBqEqk3gepRo9KXcDK3Q7iv5PnRFdzz8tdwLvdEHfdEPyVAIIYQQQgghhBBCQn8MwEAM+koegmEYiTFfyuMxCdO+kGdhHhZ+Li/Fis/k1Z/K6y7JGy7Kmy/IW8+nLk12nUl9n8m/libH/vPSJCkX/yfP7yxLCp385SWvJc6mPoqTsiwp/3HqozhVPpGrp9xdQpC6BGtA0MYUaf6N3ArtvpXvQ1d0x8Pfyb3QG33QF/2QDIUQQgghhBBCCCEk9McADMSgb+UhGIYRGI3x38iTMA2zvpbnYuGX8pIv5OWfySsvy2tS7jK5JG/8WN6c8mjO+cT7TM788hLYA/9haXL8gJz0vy5Lrry35KpHcSonHsWpedXdJQ2/kpsSsAXBW1Oo/fdypx/kruj+o/wweqE3+qAv+iEZCiGEEEIIIYQQQkjojwF4FW9g8A/yOxiB0Rj/vTwJU7+TZ34rz/lanv+VvOjLX99lkvJoTspdJps+/uV9JldeAvu/LU2S/rUs4RcFjl/1zwf/zntLUh7FqZR4FKf65d/cXUKwZt/ILQnalsAdKNCZUvf/XX4QPf8hP/aT/CSewfP4E5KhEEIIIYQQQgghhIS/4iW8ijcw+B/yOxjxd3k0xv0ov/+DPOU7efq38uxv5HlX3WWy7PPEXSa/fTTnN+8z+Z+WJkm/tyy5+iWvV95bkvIoTsXEozg/313ymVznqrtLmlx5HIew7b6XOxK8CwW6UeShf1y1MPmn/Ayex5+QjPjEJz7xiU984hOf+MQnPvGJT3ziE5+fP/+U/4qX8CrewOCf5KH/kIfjvb/LY3+UJ/4gT/5envY/3GWyKnGXyb8ezbnqfSZXvwT256XJ8V8vTf4/9AbFn2KK2Q0AAAAASUVORK5CYII=";

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <filter
        id={id}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={mapSrc}
          xlinkHref={mapSrc}
          preserveAspectRatio="none"
          x="0"
          y="0"
          width="100%"
          height="100%"
          result="map"
        />
        {chromaticAberration ? (
          <>
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale - 3}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="dR"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="dG"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale + 3}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="dB"
            />
            <feBlend in="dR" in2="dG" mode="screen" result="dRG" />
            <feBlend in="dRG" in2="dB" mode="screen" />
          </>
        ) : (
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        )}
      </filter>
    </svg>
  );
}
